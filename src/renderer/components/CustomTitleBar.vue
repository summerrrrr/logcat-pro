<template>
  <div class="custom-titlebar" @mousedown="handleTitlebarMouseDown">
    <div class="titlebar-left no-drag">
      <!-- 首页模式显示 Logo -->
      <div v-if="currentMode === 'home'" class="home-title">
        LogCat Pro
      </div>

      <!-- 子模块模式显示图标代替标题 -->
      <template v-else>
        <div 
          class="module-icon-wrap" 
          :class="{ 'no-border': currentMode !== 'file' }"
          :title="modeTitle"
        >
          <el-icon><component :is="modeIcon" /></el-icon>
        </div>
      </template>

      <!-- Only show File Import in file mode, hide Settings in all sub-modes -->
      <div 
        v-if="currentMode === 'file'" 
        class="settings-btn" 
        @click="$emit('open-settings', 'local-file')" 
        title="导入文件"
      >
        <el-icon><Plus /></el-icon>
      </div>
      <div 
        v-else-if="currentMode === 'home'"
        class="settings-btn" 
        @click="$emit('open-settings', 'general')" 
        title="系统设置"
      >
        <el-icon><Setting /></el-icon>
      </div>

      <!-- Search hint for file mode -->
      <div v-if="currentMode === 'file'" class="titlebar-hint">
        <span class="shortcut">Ctrl + F</span> 查找
      </div>
    </div>
    
    <!-- Drag area -->
    <div class="titlebar-center drag-region"></div>
    
    <div class="titlebar-right no-drag">
      <div class="window-btn" @click="minimize">
        <el-icon><Minus /></el-icon>
      </div>
      <div class="window-btn" @click="maximize">
        <el-icon v-if="!isMaximized"><FullScreen /></el-icon>
        <el-icon v-else><CopyDocument style="transform: scale(0.85);" /></el-icon>
      </div>
      <div class="window-btn close-btn" @click="handleClose">
        <el-icon><Close /></el-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, h } from 'vue'
import { 
  Minus, FullScreen, CopyDocument, Close, Setting, Plus,
  Iphone, Document, PieChart, ChatDotRound, Monitor
} from '@element-plus/icons-vue'
import { ElMessageBox, ElCheckbox, ElRadioGroup, ElRadio } from 'element-plus'
import { useConfigStore } from '../stores/configStore'
import { useLogStore } from '../stores/logStore'
import { useDeviceStore } from '../stores/deviceStore'

const configStore = useConfigStore()
const logStore = useLogStore()
const deviceStore = useDeviceStore()

const props = defineProps<{
  currentMode: 'home' | 'live' | 'file' | 'perf' | 'chat'
}>()

const emit = defineEmits(['open-settings', 'change-mode'])

const modeTitle = computed(() => {
  const titles = {
    'live': '实时设备日志',
    'file': '本地文件分析',
    'perf': '性能监控中心',
    'chat': '智能诊断助手'
  }
  return titles[props.currentMode] || ''
})

const modeIcon = computed(() => {
  const icons = {
    'live': Iphone,
    'file': Document,
    'perf': PieChart,
    'chat': ChatDotRound
  }
  return icons[props.currentMode] || Monitor
})

const isMaximized = ref(false)
let removeListener: (() => void) | null = null

onMounted(() => {
  if (window.electronAPI?.window?.onMaximizedChange) {
    removeListener = window.electronAPI.window.onMaximizedChange((state: boolean) => {
      isMaximized.value = state
    })
  }
})

onUnmounted(() => {
  if (removeListener) removeListener()
})

function minimize() {
  window.electronAPI.window.minimize()
}

function maximize() {
  window.electronAPI.window.maximize()
}

function handleTitlebarMouseDown() {
  document.body.dispatchEvent(new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    view: window
  }))
}

async function stopAllActivities() {
  try {
    if (deviceStore.activeDevice) {
      await logStore.stopCollection(deviceStore.activeDevice)
    }
  } catch (e) {
    console.warn('[TitleBar] Failed to stop collection:', e)
  }
  try {
    deviceStore.stopWatching()
  } catch (e) {}
}

async function handleClose() {
  if (props.currentMode !== 'home') {
    if (configStore.skipExitConfirmation) {
      await stopAllActivities()
      emit('change-mode', 'home')
      return
    }

    const skipRef = ref(false)
    const contentComponent = {
      render() {
        return h('div', null, [
          h('p', null, '确认要退出当前模块回到首页吗？'),
          h(
            ElCheckbox,
            {
              modelValue: skipRef.value,
              'onUpdate:modelValue': (val: boolean) => {
                skipRef.value = val
              },
              style: 'margin-top: 10px'
            },
            { default: () => '不再提示' }
          )
        ])
      }
    }

    try {
      await ElMessageBox({
        title: '提示',
        message: h(contentComponent),
        showCancelButton: true,
        confirmButtonText: '确定',
        cancelButtonText: '取消',
      })
      if (skipRef.value) {
        configStore.skipExitConfirmation = true
      }
      await stopAllActivities()
      emit('change-mode', 'home')
    } catch {}
  } else {
    if (configStore.skipHomeCloseConfirmation) {
      executeCloseAction(configStore.closeAction)
      return
    }

    const skipRef = ref(false)
    const actionRef = ref<'exit' | 'minimize'>(configStore.closeAction)

    const homeCloseComponent = {
      render() {
        return h('div', { style: 'display: flex; flex-direction: column; gap: 16px; margin-top: 10px;' }, [
          h(
            ElRadioGroup,
            {
              modelValue: actionRef.value,
              'onUpdate:modelValue': (val: 'exit' | 'minimize') => {
                actionRef.value = val
              }
            },
            {
              default: () => [
                h(ElRadio, { value: 'minimize' }, { default: () => '最小化到系统托盘' }),
                h(ElRadio, { value: 'exit' }, { default: () => '直接退出程序' })
              ]
            }
          ),
          h(
            ElCheckbox,
            {
              modelValue: skipRef.value,
              'onUpdate:modelValue': (val: boolean) => {
                skipRef.value = val
              }
            },
            { default: () => '记住我的选择，下次不再提示' }
          )
        ])
      }
    }

    try {
      await ElMessageBox({
        title: '关闭程序',
        message: h(homeCloseComponent),
        showCancelButton: true,
        confirmButtonText: '确定',
        cancelButtonText: '取消',
      })
      if (skipRef.value) {
        configStore.skipHomeCloseConfirmation = true
      }
      configStore.closeAction = actionRef.value
      executeCloseAction(actionRef.value)
    } catch {}
  }
}

function executeCloseAction(action: 'exit' | 'minimize') {
  if (action === 'minimize') window.electronAPI.window.minimize()
  else window.electronAPI.window.close()
}
</script>

<style scoped>
.custom-titlebar {
  display: flex;
  height: 32px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  user-select: none;
  flex-shrink: 0;
}

.titlebar-left {
  display: flex;
  align-items: center;
  padding-left: 8px;
}

.home-title {
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.5px;
}

.module-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 32px;
  color: var(--accent);
  font-size: 18px;
  border-right: 1px solid var(--border-color);
  margin-right: 8px;
}

.module-icon-wrap.no-border {
  border-right: none;
  margin-right: 0;
}

.settings-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.settings-btn:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

.settings-btn:hover .el-icon {
  transform: rotate(90deg);
}

.settings-btn .el-icon {
  font-size: 16px;
  transition: transform 0.3s ease;
}

.titlebar-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-muted);
}

.titlebar-hint .shortcut {
  background: var(--bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.titlebar-center {
  flex: 1;
}

.drag-region {
  -webkit-app-region: drag;
  height: 100%;
}

.no-drag {
  -webkit-app-region: no-drag;
}

.titlebar-right {
  display: flex;
}

.window-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 46px;
  height: 32px;
  color: var(--text-primary);
  cursor: pointer;
}

.window-btn:hover {
  background: var(--bg-hover);
}

.window-btn.close-btn:hover {
  background: #e81123;
  color: white;
}
</style>