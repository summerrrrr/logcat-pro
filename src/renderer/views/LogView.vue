<template>
  <div class="log-view" ref="containerRef">
    <div ref="scrollRef" class="log-scroll" @scroll="onScroll">
      <div :style="{ height: totalSize + 'px', position: 'relative' }">
        <div
          v-for="row in virtualRows"
          :key="row.key"
          :data-index="row.index"
          :ref="el => { if (el) virtualizer.measureElement(el as Element) }"
          class="log-row"
          :class="[
            `level-${logStore.filteredLogs[row.index].level.toLowerCase()}`,
            { selected: logStore.selectedLog?.id === logStore.filteredLogs[row.index].id }
          ]"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${row.start}px)`
          }"
          @click="logStore.selectLog(logStore.filteredLogs[row.index])"
        >
          <div class="col-time">{{ formatTime(logStore.filteredLogs[row.index].timestamp) }}</div>
          <div class="col-level" :class="`level-${logStore.filteredLogs[row.index].level.toLowerCase()}`">
            {{ logStore.filteredLogs[row.index].level }}
          </div>
          <div class="col-pid">{{ logStore.filteredLogs[row.index].pid }}</div>
          <div class="col-tag">{{ logStore.filteredLogs[row.index].tag }}</div>
          <div class="col-msg">{{ logStore.filteredLogs[row.index].message }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useLogStore } from '../stores/logStore'

const logStore = useLogStore()
const scrollRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

const rowCount = computed(() => logStore.filteredLogs.length)

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rowCount.value,
    getScrollElement: () => scrollRef.value,
    estimateSize: () => 30,
    overscan: 10
  }))
)

const virtualRows = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

function formatTime(ts: string) {
  const timeIdx = ts.indexOf(' ')
  if (timeIdx >= 0) {
    return ts.substring(timeIdx + 1)
  }
  return ts
}

let userScrolled = false

function onScroll() {
  if (!scrollRef.value) return
  const el = scrollRef.value
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  userScrolled = !atBottom
  logStore.autoScroll = atBottom
}

function handleCopy(e: ClipboardEvent) {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return

  // Check which log rows are intersected by the user's selection
  const selectedIndices: number[] = []
  const rowElements = document.querySelectorAll('.log-row')
  
  rowElements.forEach(row => {
    if (selection.containsNode(row, true)) {
      const idx = parseInt(row.getAttribute('data-index') || '-1')
      if (idx !== -1) {
        selectedIndices.push(idx)
      }
    }
  })

  // If the selection touches any log row, we provide the cleaned raw ADB text
  if (selectedIndices.length > 0) {
    const min = Math.min(...selectedIndices)
    const max = Math.max(...selectedIndices)
    
    // Construct the text from actual log entries to maintain perfect formatting
    const logsText = []
    for (let i = min; i <= max; i++) {
      const log = logStore.filteredLogs[i]
      if (log && log.raw) {
        logsText.push(log.raw)
      }
    }
    
    if (e.clipboardData && logsText.length > 0) {
      e.clipboardData.setData('text/plain', logsText.join('\n'))
      e.preventDefault() // Stop browser from getting messy DOM fragments
    }
  }
}

onMounted(() => {
  window.addEventListener('copy', handleCopy)
})

onUnmounted(() => {
  window.removeEventListener('copy', handleCopy)
})

watch(rowCount, (newCount) => {
  if (logStore.autoScroll && !userScrolled && newCount > 0) {
    nextTick(() => {
      virtualizer.value.scrollToIndex(newCount - 1, { align: 'end' })
    })
  }
})
</script>

<style scoped>
.log-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}
.log-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.log-row {
  display: flex;
  align-items: flex-start;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
  padding: 4px 12px;
  cursor: pointer;
  border-left: 3px solid transparent;
  word-break: break-all;
  box-sizing: border-box;
}
.log-row:hover {
  background: var(--bg-hover);
}
.log-row.selected {
  background: var(--bg-surface);
}
.log-row.level-v { border-left-color: var(--log-verbose); }
.log-row.level-d { border-left-color: var(--log-debug); }
.log-row.level-i { border-left-color: var(--log-info); }
.log-row.level-w { border-left-color: var(--log-warn); }
.log-row.level-e { border-left-color: var(--log-error); }
.log-row.level-f { border-left-color: var(--log-fatal); }

.col-time {
  width: 100px;
  flex-shrink: 0;
  color: var(--text-muted);
}
.col-level {
  width: 20px;
  flex-shrink: 0;
  font-weight: 700;
  text-align: center;
}
.col-level.level-v { color: var(--log-verbose); }
.col-level.level-d { color: var(--log-debug); }
.col-level.level-i { color: var(--log-info); }
.col-level.level-w { color: var(--log-warn); }
.col-level.level-e { color: var(--log-error); }
.col-level.level-f { color: var(--log-fatal); }

.col-pid {
  width: 60px;
  flex-shrink: 0;
  color: var(--text-muted);
  text-align: right;
  padding-right: 8px;
}
.col-tag {
  width: 140px;
  flex-shrink: 0;
  color: var(--accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.col-msg {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  white-space: pre-wrap;
  color: var(--text-primary);
}
.log-row.level-w .col-msg { color: var(--log-warn); }
.log-row.level-e .col-msg { color: var(--log-error); }
.log-row.level-f .col-msg { color: var(--log-fatal); }
</style>