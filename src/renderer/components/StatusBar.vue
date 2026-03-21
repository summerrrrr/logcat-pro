<template>
  <div class="status-bar">
    <div class="status-left">
      <span class="status-indicator" :class="statusClass" />
      <span class="status-text">{{ statusText }}</span>
    </div>
    <div class="status-right">
      <span class="status-item">
        {{ logStore.logRate }} 条/秒
      </span>
      <span class="status-divider">|</span>
      <span class="status-item">
        共 {{ logStore.totalCount.toLocaleString() }} 条
      </span>
      <span class="status-divider">|</span>
      <span class="status-item">
        {{ deviceStore.devices.filter(d => d.status === 'device').length }} 台设备
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLogStore } from '../stores/logStore'
import { useDeviceStore } from '../stores/deviceStore'

const logStore = useLogStore()
const deviceStore = useDeviceStore()

const statusClass = computed(() => {
  if (logStore.isCollecting && !logStore.isPaused) return 'collecting'
  if (logStore.isPaused) return 'paused'
  return 'idle'
})

const statusText = computed(() => {
  if (logStore.isCollecting && !logStore.isPaused) return ''
  if (logStore.isPaused) return '已暂停'
  return '空闲'
})
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  padding: 0 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-muted);
}
.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-indicator.collecting {
  background: var(--success);
  animation: pulse 1.5s infinite;
}
.status-indicator.paused {
  background: var(--warning);
}
.status-indicator.idle {
  background: var(--text-muted);
}
.status-text {
  font-weight: 500;
}
.status-divider {
  color: var(--border-color);
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
