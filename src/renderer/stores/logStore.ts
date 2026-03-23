import { defineStore } from 'pinia'
import { ref, computed, shallowRef, triggerRef } from 'vue'
import type { LogEntry, LogFilter, CollectorOptions } from '../../shared/types'

const MAX_LOGS = 50_000

export const useLogStore = defineStore('log', () => {
  // Use shallowRef for the logs array — Vue won't deep-track each LogEntry
  const logs = shallowRef<LogEntry[]>([])
  const isCollecting = ref(false)
  const isPaused = ref(false)
  const selectedLog = ref<LogEntry | null>(null)
  const autoScroll = ref(true)
  const totalCount = ref(0)
  const logRate = ref(0)
  let cleanupOnData: (() => void) | null = null

  const filter = ref<LogFilter>({
    levels: ['V', 'D', 'I', 'W', 'E'],
    tag: '',
    keyword: '',
    regex: false,
    pid: null,
    timeStart: null,
    timeEnd: null,
  })

  const filterHistory = ref<string[]>([])
  const excludeHistory = ref<string[]>([])

  function addFilterHistory(tag: string) {
    if (!tag) return
    const index = filterHistory.value.indexOf(tag)
    if (index > -1) {
      filterHistory.value.splice(index, 1)
    }
    filterHistory.value.unshift(tag)
    if (filterHistory.value.length > 10) {
      filterHistory.value.pop()
    }
  }

  function addExcludeHistory(tag: string) {
    if (!tag) return
    const index = excludeHistory.value.indexOf(tag)
    if (index > -1) {
      excludeHistory.value.splice(index, 1)
    }
    excludeHistory.value.unshift(tag)
    if (excludeHistory.value.length > 10) {
      excludeHistory.value.pop()
    }
  }

  function removeFilterHistory(tag: string) {
    filterHistory.value = filterHistory.value.filter(t => t !== tag)
  }

  function removeExcludeHistory(tag: string) {
    excludeHistory.value = excludeHistory.value.filter(t => t !== tag)
  }

  // Support for multiple saved filters
  const savedFilters = ref<Record<string, LogFilter>>({})
  
  // Custom tag/keyword highlighting colors
  const highlightRules = ref<Array<{ pattern: string, color: string, isRegex: boolean }>>([
    { pattern: 'fatal', color: 'var(--log-fatal)', isRegex: false },
    { pattern: 'exception', color: 'var(--log-error)', isRegex: false },
    { pattern: 'anr', color: 'var(--critical)', isRegex: false }
  ])

  // Rate tracking
  let rateCount = 0
  let rateTimer: ReturnType<typeof setInterval> | null = null

  const filteredLogs = computed(() => {
    const f = filter.value
    const all = logs.value
    // Fast path: no filters active
    const hasLevelFilter = f.levels.length < 5
    const hasTagFilter = !!f.tag
    const hasKeyword = !!f.keyword
    const hasPidFilter = f.pid !== null

    if (!hasLevelFilter && !hasTagFilter && !hasKeyword && !hasPidFilter) {
      return all
    }

    let regexObj: RegExp | null = null
    if (hasKeyword && f.regex) {
      try {
        regexObj = new RegExp(f.keyword, 'i')
      } catch {
        return []
      }
    }
    const kwLower = f.keyword.toLowerCase()

    return all.filter(log => {
      if (hasLevelFilter && !f.levels.includes(log.level)) return false
      
      // 1. Search (Inclusive: Message OR Tag)
      if (hasTagFilter) {
        const tagMatch = log.tag.toLowerCase().includes(f.tag.toLowerCase())
        const msgMatch = log.message.toLowerCase().includes(f.tag.toLowerCase())
        if (!tagMatch && !msgMatch) return false
      }

      // 2. PID Filter
      if (hasPidFilter && Number(log.pid) !== Number(f.pid)) return false

      // 3. Exclusion Filter (Exclusive: Tag ONLY, Exact Match)
      if (hasKeyword) {
        if (log.tag.toLowerCase() === kwLower) return false
      }
      return true
    })
  })

  function addHighlightRule(rule: { pattern: string, color: string, isRegex: boolean }) {
    highlightRules.value.push(rule)
  }

  function saveFilter(name: string) {
    savedFilters.value[name] = { ...filter.value }
  }

  function applySavedFilter(name: string) {
    if (savedFilters.value[name]) {
      filter.value = { ...savedFilters.value[name] }
    }
  }

  async function startCollection(serial: string, options?: CollectorOptions) {
    // Clean up previous listener
    if (cleanupOnData) {
      cleanupOnData()
      cleanupOnData = null
    }

    logs.value = []
    totalCount.value = 0
    rateCount = 0
    logRate.value = 0

    // Start rate timer
    if (rateTimer) clearInterval(rateTimer)
    rateTimer = setInterval(() => {
      logRate.value = rateCount
      rateCount = 0
    }, 1000)

    // Batch incoming logs — accumulate and flush to UI at 200ms intervals
    let pendingLogs: LogEntry[] = []
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    function flushPending() {
      flushTimer = null
      if (pendingLogs.length === 0) return

      const batch = pendingLogs
      pendingLogs = []

      const current = logs.value
      let newArr: LogEntry[]
      if (current.length + batch.length > MAX_LOGS) {
        newArr = current.slice(-(MAX_LOGS - batch.length)).concat(batch)
      } else {
        newArr = current.concat(batch)
      }
      // Replace the shallowRef value to trigger reactivity
      logs.value = newArr
      totalCount.value += batch.length
    }

    cleanupOnData = window.electronAPI.log.onData((incoming: unknown) => {
      const arr = incoming as LogEntry[]
      rateCount += arr.length
      pendingLogs.push(...arr)

      // Debounce flush to 200ms
      if (!flushTimer) {
        flushTimer = setTimeout(flushPending, 200)
      }
    })

    await window.electronAPI.log.start(serial, options)
    isCollecting.value = true
    isPaused.value = false
  }

  async function stopCollection(serial: string) {
    await window.electronAPI.log.stop(serial)
    isCollecting.value = false
    isPaused.value = false
    if (rateTimer) {
      clearInterval(rateTimer)
      rateTimer = null
    }
    logRate.value = 0
    if (cleanupOnData) {
      cleanupOnData()
      cleanupOnData = null
    }
  }

  async function pauseCollection(serial: string) {
    await window.electronAPI.log.pause(serial)
    isPaused.value = true
  }

  async function resumeCollection(serial: string) {
    await window.electronAPI.log.resume(serial)
    isPaused.value = false
  }

  function clearLogs(serial?: string) {
    if (serial) {
      window.electronAPI.log.clear(serial)
    }
    logs.value = []
    totalCount.value = 0
    rateCount = 0
    logRate.value = 0
    selectedLog.value = null
    isCollecting.value = false
    isPaused.value = false
    if (rateTimer) {
      clearInterval(rateTimer)
      rateTimer = null
    }
    // 重置过滤器
    filter.value = {
      levels: ['V', 'D', 'I', 'W', 'E'],
      tag: '',
      keyword: '',
      regex: false,
      pid: null,
      timeStart: null,
      timeEnd: null,
    }
  }

  function setFilter(partial: Partial<LogFilter>) {
    filter.value = { ...filter.value, ...partial }
  }

  function selectLog(log: LogEntry | null) {
    selectedLog.value = log
  }

  return {
    logs,
    isCollecting,
    isPaused,
    filter,
    filterHistory,
    excludeHistory,
    totalCount,
    logRate,
    selectedLog,
    autoScroll,
    filteredLogs,
    startCollection,
    stopCollection,
    pauseCollection,
    resumeCollection,
    clearLogs,
    setFilter,
    selectLog,
    addFilterHistory,
    addExcludeHistory,
    removeFilterHistory,
    removeExcludeHistory,
  }
})
