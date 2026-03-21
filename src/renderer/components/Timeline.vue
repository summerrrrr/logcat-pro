<template>
  <div class="timeline-bar" ref="timelineRef">
    <div class="timeline-track">
      <div
        v-for="marker in markers"
        :key="marker.issue.id"
        class="timeline-marker"
        :class="marker.issue.type"
        :style="{ left: marker.position + '%' }"
        :title="`${marker.issue.type}: ${marker.issue.title}`"
      />
    </div>
    <div class="timeline-labels">
      <span class="timeline-start">{{ timeRange.start }}</span>
      <span class="timeline-end">{{ timeRange.end }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAnalysisStore } from '../stores/analysisStore'
import { useLogStore } from '../stores/logStore'

const analysisStore = useAnalysisStore()
const logStore = useLogStore()

const timeRange = computed(() => {
  const logs = logStore.logs
  if (!logs.length) return { start: '--:--', end: '--:--', startMs: 0, endMs: 0 }
  const startMs = new Date(logs[0].timestamp).getTime()
  const endMs = new Date(logs[logs.length - 1].timestamp).getTime()
  return {
    start: new Date(startMs).toLocaleTimeString(),
    end: new Date(endMs).toLocaleTimeString(),
    startMs,
    endMs,
  }
})

const markers = computed(() => {
  const range = timeRange.value
  if (!range.startMs || !range.endMs || range.startMs === range.endMs) return []
  const span = range.endMs - range.startMs

  return analysisStore.issues.map(issue => {
    const issueMs = new Date(issue.timestamp).getTime()
    const position = Math.max(0, Math.min(100, ((issueMs - range.startMs) / span) * 100))
    return { issue, position }
  })
})
</script>

<style scoped>
.timeline-bar {
  padding: 4px 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}
.timeline-track {
  position: relative;
  height: 12px;
  background: var(--bg-surface);
  border-radius: 6px;
  overflow: hidden;
}
.timeline-marker {
  position: absolute;
  top: 1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transform: translateX(-50%);
  cursor: pointer;
}
.timeline-marker.crash { background: var(--log-error); }
.timeline-marker.anr { background: var(--log-fatal); }
.timeline-marker.performance { background: var(--log-warn); }
.timeline-marker.custom { background: var(--log-info); }
.timeline-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
