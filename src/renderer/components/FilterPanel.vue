<template>
  <div class="filter-panel" ref="panelRef">
    <div class="level-toggles">
      <button
        v-for="level in levels"
        :key="level.key"
        class="level-btn"
        :class="{ active: logStore.filter.levels.includes(level.key) }"
        :style="{ '--level-color': level.color }"
        @click="toggleLevel(level.key)"
      >
        {{ level.label }}
      </button>
    </div>

    <div class="divider"></div>

    <el-select
      ref="selectRef"
      v-model="selectedPid"
      placeholder="进程 / 包名"
      size="small"
      clearable
      filterable
      style="width: 200px"
      @change="onPidSelect"
      @visible-change="onDropdownVisibleChange"
      :loading="loadingProcesses"
      popper-class="pid-select-popper"
    >
      <el-option
        v-for="p in processList"
        :key="p.pid"
        :label="`${p.name} (${p.pid})`"
        :value="p.pid"
      >
        <div class="pid-option">
          <span class="p-name">{{ p.name }}</span>
          <span class="p-id">{{ p.pid }}</span>
        </div>
      </el-option>
    </el-select>

    <el-input
      v-model="tagFilter"
      placeholder="搜索"
      size="small"
      clearable
      style="width: 180px"
      @input="onTagInput"
      @keyup.enter="onTagEnter"
      @blur="onTagBlur"
    >
      <template #prefix>
        <el-dropdown trigger="click" @command="onTagChange" v-if="logStore.filterHistory.length" placement="bottom-start">
          <div class="history-prefix">
            <el-icon><Search /></el-icon>
            <el-icon class="arrow-icon"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu class="history-dropdown-menu">
              <el-dropdown-item v-for="item in logStore.filterHistory" :key="item" :command="item">
                <div class="history-option">
                  <span>{{ item }}</span>
                  <el-icon class="delete-icon" @click.stop="onRemoveFilterHistory(item)"><Close /></el-icon>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-icon v-else><Search /></el-icon>
      </template>
    </el-input>

    <el-input
      v-model="keywordFilter"
      placeholder="排除标签"
      size="small"
      clearable
      style="flex: 1; min-width: 200px"
      @input="onKeywordInput"
      @keyup.enter="onExcludeEnter"
      @blur="onExcludeBlur"
    >
      <template #prefix>
        <el-dropdown trigger="click" @command="onExcludeChange" v-if="logStore.excludeHistory.length" placement="bottom-start">
          <div class="history-prefix">
            <el-icon><FilterIcon /></el-icon>
            <el-icon class="arrow-icon"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu class="history-dropdown-menu">
              <el-dropdown-item v-for="item in logStore.excludeHistory" :key="item" :command="item">
                <div class="history-option">
                  <span>{{ item }}</span>
                  <el-icon class="delete-icon" @click.stop="onRemoveExcludeHistory(item)"><Close /></el-icon>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-icon v-else><FilterIcon /></el-icon>
      </template>
    </el-input>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Search, Filter as FilterIcon, Close, ArrowDown } from '@element-plus/icons-vue'
import { useLogStore } from '../stores/logStore'
import { useDeviceStore } from '../stores/deviceStore'
import type { LogLevel, ProcessInfo } from '../../shared/types'

const logStore = useLogStore()
const deviceStore = useDeviceStore()

const selectRef = ref<any>(null)
const panelRef = ref<HTMLElement | null>(null)

const levels: { key: LogLevel; label: string; color: string }[] = [
  { key: 'V', label: 'V', color: 'var(--log-verbose)' },
  { key: 'D', label: 'D', color: 'var(--log-debug)' },
  { key: 'I', label: 'I', color: 'var(--log-info)' },
  { key: 'W', label: 'W', color: 'var(--log-warn)' },
  { key: 'E', label: 'E', color: 'var(--log-error)' },
]

const tagFilter = ref(logStore.filter.tag)
const keywordFilter = ref(logStore.filter.keyword)
const selectedPid = ref<number | ''>('')
const processList = ref<ProcessInfo[]>([])
const loadingProcesses = ref(false)

// Sync from store
watch(() => logStore.filter.tag, (val) => { tagFilter.value = val })
watch(() => logStore.filter.keyword, (val) => { keywordFilter.value = val })
watch(() => logStore.filter.pid, (val) => { selectedPid.value = val === null ? '' : val })

function toggleLevel(level: LogLevel) {
  const current = [...logStore.filter.levels]
  const idx = current.indexOf(level)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(level)
  logStore.setFilter({ levels: current })
}

function onTagChange(val: string) {
  tagFilter.value = val
  logStore.setFilter({ tag: val })
}

function onTagInput() {
  logStore.setFilter({ tag: tagFilter.value })
}

function onTagBlur() {
  if (tagFilter.value) {
    logStore.addFilterHistory(tagFilter.value)
  }
}

function onTagEnter() {
  if (tagFilter.value) {
    logStore.addFilterHistory(tagFilter.value)
    logStore.setFilter({ tag: tagFilter.value })
  }
}

function onExcludeChange(val: string) {
  keywordFilter.value = val
  logStore.setFilter({ keyword: val })
}

function onKeywordInput() {
  logStore.setFilter({ keyword: keywordFilter.value })
}

function onExcludeBlur() {
  if (keywordFilter.value) {
    logStore.addExcludeHistory(keywordFilter.value)
  }
}

function onExcludeEnter() {
  if (keywordFilter.value) {
    logStore.addExcludeHistory(keywordFilter.value)
    logStore.setFilter({ keyword: keywordFilter.value })
  }
}

function onRemoveFilterHistory(item: string) {
  logStore.removeFilterHistory(item)
}

function onRemoveExcludeHistory(item: string) {
  logStore.removeExcludeHistory(item)
}

function onPidSelect(val: any) {
  const pid = val === '' || val === null ? null : Number(val)
  logStore.setFilter({ pid })
}

async function onDropdownVisibleChange(visible: boolean) {
  if (visible && deviceStore.activeDevice) {
    loadingProcesses.value = true
    try {
      processList.value = await window.electronAPI.device.listProcesses(deviceStore.activeDevice)
    } catch (e) {
      processList.value = []
    } finally {
      loadingProcesses.value = false
    }
  }
}

// Workaround for dropdown not closing on outside click in some Electron setups
const handleOutsideClick = (e: MouseEvent) => {
  if (selectRef.value && selectRef.value.expanded) {
    const popper = document.querySelector('.pid-select-popper')
    const isInsideSelect = selectRef.value.$el.contains(e.target)
    const isInsidePopper = popper && popper.contains(e.target as Node)
    
    if (!isInsideSelect && !isInsidePopper) {
      selectRef.value.blur()
    }
  }
}

onMounted(() => {
  window.addEventListener('mousedown', handleOutsideClick)
})

onUnmounted(() => {
  window.removeEventListener('mousedown', handleOutsideClick)
})
</script>

<style scoped>
.filter-panel {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.level-toggles {
  display: flex;
  gap: 4px;
}
.level-btn {
  width: 28px;
  height: 24px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.level-btn.active {
  background: var(--level-color);
  color: var(--bg-primary);
  border-color: var(--level-color);
}
.level-btn:hover:not(.active) {
  border-color: var(--accent);
  color: var(--text-secondary);
}
.divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 4px;
}
.history-option {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 160px;
}
.history-option span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-prefix {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s;
  padding: 0 4px;
  margin-left: -4px;
}
.history-prefix:hover {
  color: var(--accent);
  background: var(--bg-hover);
  border-radius: 4px;
}
.arrow-icon {
  font-size: 12px;
  margin-left: 2px;
  opacity: 0.7;
}
.delete-icon {
  margin-left: 8px;
  margin-right: -4px;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s;
  padding: 4px;
  border-radius: 4px;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
}
.delete-icon:hover {
  color: var(--danger);
  background: var(--danger-dim);
  transform: scale(1.2);
  opacity: 1;
}
</style>

<style>
.history-dropdown-menu {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
  box-shadow: var(--shadow-lg) !important;
  padding: 4px 0 !important;
}
.history-dropdown-menu .el-dropdown-menu__item {
  color: var(--text-primary) !important;
  padding: 4px 8px 4px 12px !important;
}
.history-dropdown-menu .el-dropdown-menu__item:hover {
  background: var(--bg-hover) !important;
}
.pid-select-popper {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 8px !important;
  box-shadow: var(--shadow-lg) !important;
}
.pid-select-popper .el-select-dropdown__item {
  height: 34px !important;
  line-height: 34px !important;
  padding: 0 12px !important;
}
.pid-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  width: 100%;
}
.p-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-primary);
}
.p-id {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-surface);
  padding: 0 6px;
  border-radius: 4px;
  line-height: 18px;
  height: 18px;
}
.pid-select-popper .el-select-dropdown__item.hover {
  background: var(--bg-hover) !important;
}
.pid-select-popper .el-select-dropdown__item.selected {
  background: var(--accent-soft) !important;
  color: var(--accent) !important;
}
</style>