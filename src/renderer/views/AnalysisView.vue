<template>
  <div class="analysis-view">
    <div class="analysis-header">
      <span class="section-title">Issues ({{ analysisStore.issues.length }})</span>
      <el-button
        size="small"
        type="primary"
        @click="onRunAnalysis"
        :loading="running"
        :disabled="!logStore.logs.length"
      >
        Run Analysis
      </el-button>
    </div>
    <div class="issue-list">
      <div
        v-for="issue in analysisStore.issues"
        :key="issue.id"
        class="issue-item"
      >
        <div class="issue-header" @click="toggleExpand(issue.id)">
          <el-tag
            :type="severityType(issue.severity)"
            size="small"
            effect="dark"
          >
            {{ issue.severity }}
          </el-tag>
          <el-tag size="small" effect="plain" class="type-tag">
            {{ issue.type }}
          </el-tag>
          <span class="issue-title">{{ issue.title }}</span>
          <span class="issue-time">{{ formatTime(issue.timestamp) }}</span>
        </div>
        <div v-if="expanded.has(issue.id)" class="issue-detail">
          <p>{{ issue.description }}</p>
          <div class="issue-meta">
            <span>Device: {{ issue.deviceSerial }}</span>
            <span>Related logs: {{ issue.logIds.length }}</span>
          </div>
        </div>
      </div>
      <div v-if="!analysisStore.issues.length" class="empty-state">
        No issues detected. Click "Run Analysis" to scan logs.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAnalysisStore } from '../stores/analysisStore'
import { useLogStore } from '../stores/logStore'

const analysisStore = useAnalysisStore()
const logStore = useLogStore()

const running = ref(false)
const expanded = reactive(new Set<string>())

function toggleExpand(id: string) {
  if (expanded.has(id)) {
    expanded.delete(id)
  } else {
    expanded.add(id)
  }
}

function severityType(severity: string) {
  switch (severity) {
    case 'critical': return 'danger'
    case 'warning': return 'warning'
    default: return 'info'
  }
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString()
}

async function onRunAnalysis() {
  running.value = true
  try {
    await analysisStore.runAnalysis()
    analysisStore.updateStats(logStore.logs)
  } finally {
    running.value = false
  }
}
</script>

<style scoped>
.analysis-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}
.analysis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}
.issue-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.issue-item {
  border-bottom: 1px solid var(--border-color);
}
.issue-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.issue-header:hover {
  background: var(--bg-hover);
}
.issue-title {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.issue-time {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.type-tag {
  text-transform: uppercase;
  font-size: 10px;
}
.issue-detail {
  padding: 8px 12px 12px 40px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.issue-meta {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted);
}
.empty-state {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
