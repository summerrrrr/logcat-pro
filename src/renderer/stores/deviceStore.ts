import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { Device } from '../../shared/types'

export const useDeviceStore = defineStore('device', () => {
  const devices = ref<Device[]>([])
  const activeDevice = ref<string | null>(null)
  const activePid = ref<number | null>(null)
  const isWatching = ref(false)
  const isPaused = ref(false)
  
  const performanceData = ref<{ cpu: number[], memory: number[], fps: number[], timestamps: string[] }>({
    cpu: [],
    memory: [],
    fps: [],
    timestamps: []
  })
  let perfInterval: any = null
  let errorCount = 0
  const MAX_ERRORS = 5

  let unbindConnected: (() => void) | null = null
  let unbindDisconnected: (() => void) | null = null

  async function fetchDevices() {
    devices.value = await window.electronAPI.device.list()
    if (!activeDevice.value && devices.value.length > 0) {
      activeDevice.value = devices.value[0].serial
    }
  }

  function startWatching() {
    if (isWatching.value) return // Avoid multiple watchers
    
    window.electronAPI.device.watchStart()
    isWatching.value = true

    unbindConnected = window.electronAPI.device.onConnected(async () => {
      await fetchDevices()
    })

    unbindDisconnected = window.electronAPI.device.onDisconnected(async (device: any) => {
      await fetchDevices()
      if (activeDevice.value === device.serial) {
        activeDevice.value = devices.value.length > 0 ? devices.value[0].serial : null
      }
    })
  }

  function stopWatching() {
    window.electronAPI.device.watchStop()
    if (unbindConnected) unbindConnected()
    if (unbindDisconnected) unbindDisconnected()
    unbindConnected = null
    unbindDisconnected = null
    isWatching.value = false
  }

  function startPerformancePolling() {
    if (perfInterval || !activeDevice.value || !activePid.value) return
    isPaused.value = false
    
    perfInterval = setInterval(async () => {
      if (!activeDevice.value || !activePid.value) {
        stopPerformancePolling()
        return
      }

      if (isPaused.value) return

      try {
        const data = await window.electronAPI.device.getPerformance(
          activeDevice.value,
          activePid.value
        )

        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const newTimestamps = [...performanceData.value.timestamps, now]
        const newCpu = [...performanceData.value.cpu, data.cpu]
        const newMemory = [...performanceData.value.memory, data.memory]
        const newFps = [...performanceData.value.fps, data.fps]

        // 保留最近5分钟的数据（1000ms × 300 = 300秒）
        const maxDataPoints = 300
        if (newTimestamps.length > maxDataPoints) {
          // 使用 slice 代替 shift，O(1)复杂度
          performanceData.value = {
            timestamps: newTimestamps.slice(-maxDataPoints),
            cpu: newCpu.slice(-maxDataPoints),
            memory: newMemory.slice(-maxDataPoints),
            fps: newFps.slice(-maxDataPoints)
          }
        } else {
          performanceData.value = {
            timestamps: newTimestamps,
            cpu: newCpu,
            memory: newMemory,
            fps: newFps
          }
        }

        // 重置错误计数
        errorCount = 0
      } catch (e) {
        console.error('Failed to poll performance:', e)
        errorCount++

        if (errorCount >= MAX_ERRORS) {
          ElMessage.error('性能监控失败次数过多，已自动停止')
          stopPerformancePolling()
          setActivePid(null)
        }
      }
    }, 1000)
  }

  function stopPerformancePolling() {
    if (perfInterval) {
      clearInterval(perfInterval)
      perfInterval = null
    }
    isPaused.value = false
  }

  function togglePause() {
    isPaused.value = !isPaused.value
  }

  function clearPerformanceData() {
    performanceData.value = { cpu: [], memory: [], fps: [], timestamps: [] }
  }

  function setActiveDevice(serial: string | null) {
    activeDevice.value = serial
    activePid.value = null
    stopPerformancePolling()
  }

  async function setActivePid(pid: number | null) {
    // 先停止旧的轮询
    stopPerformancePolling()

    // 清理旧进程的CPU统计缓存
    if (activePid.value && activeDevice.value) {
      try {
        await window.electronAPI.device.clearProcessStats(activeDevice.value, activePid.value)
      } catch (e) {
        console.warn('Failed to clear process stats:', e)
      }
    }

    // 设置新PID并清空数据
    activePid.value = pid
    clearPerformanceData()

    // 启动新的轮询
    if (pid) {
      startPerformancePolling()
    }
  }

  async function connectWifi(ip: string, port: number) {
    const result = await window.electronAPI.device.connectWifi(ip, port)
    await fetchDevices()
    return result
  }

  return {
    devices,
    activeDevice,
    activePid,
    isWatching,
    isPaused,
    performanceData,
    fetchDevices,
    startWatching,
    stopWatching,
    setActiveDevice,
    setActivePid,
    connectWifi,
    startPerformancePolling,
    stopPerformancePolling,
    togglePause,
    clearPerformanceData
  }
})
