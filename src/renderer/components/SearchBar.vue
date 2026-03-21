<template>
  <div class="search-bar">
    <el-input
      v-model="keyword"
      placeholder="搜索日志..."
      size="small"
      clearable
      @input="onInput"
      @clear="onClear"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
    </el-input>
    <el-tooltip content="切换正则模式">
      <el-button
        size="small"
        :type="isRegex ? 'primary' : 'default'"
        class="regex-btn"
        @click="toggleRegex"
      >
        .*
      </el-button>
    </el-tooltip>
    <span v-if="keyword" class="match-count">
      {{ matchCount }} 条匹配
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useLogStore } from '../stores/logStore'

const logStore = useLogStore()

const keyword = ref(logStore.filter.keyword)
const isRegex = ref(logStore.filter.regex)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    logStore.setFilter({ keyword: keyword.value, regex: isRegex.value })
  }, 300)
}

function onClear() {
  logStore.setFilter({ keyword: '' })
}

function toggleRegex() {
  isRegex.value = !isRegex.value
  logStore.setFilter({ regex: isRegex.value, keyword: keyword.value })
}

const matchCount = computed(() => logStore.filteredLogs.length)
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.regex-btn {
  font-family: var(--font-mono);
  font-weight: 700;
  min-width: 36px;
}
.match-count {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
