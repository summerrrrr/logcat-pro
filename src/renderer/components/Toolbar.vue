<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="app-title">LogCat Pro</span>
    </div>
    <div class="toolbar-center">
      <el-button-group>
        <el-button size="small" type="success" :disabled="!deviceStore.activeDevice || logStore.isCollecting" @click="onStart">
          <el-icon><VideoPlay /></el-icon> 开始
        </el-button>
        <el-button size="small" type="danger" :disabled="!logStore.isCollecting" @click="onStop">
          <el-icon><SwitchButton /></el-icon> 停止
        </el-button>
        <el-button size="small" :disabled="!logStore.logs.length" @click="onClear">
          <el-icon><Delete /></el-icon> 清空
        </el-button>
      </el-button-group>
    </div>
    <div class="toolbar-right">
      <el-button size="small" @click="onExport" :disabled="logStore.isCollecting || !logStore.logs.length">
        <el-icon><Download /></el-icon> 导出
      </el-button>
      <el-button size="small" @click="onOpenSettings">
        <el-icon><Setting /></el-icon> 设置
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { VideoPlay, SwitchButton, Delete, Download, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useDeviceStore } from '../stores/deviceStore'
import { useLogStore } from '../stores/logStore'
import { useConfigStore } from '../stores/configStore'

const deviceStore = useDeviceStore()
const logStore = useLogStore()
const configStore = useConfigStore()

const emit = defineEmits(['open-settings'])

function onOpenSettings() {
  emit('open-settings', 'general')
}

async function onStart() {
  if (!deviceStore.activeDevice) return
  await logStore.startCollection(deviceStore.activeDevice)
}

async function onStop() {
  if (!deviceStore.activeDevice) return
  await logStore.stopCollection(deviceStore.activeDevice)
}

function onClear() {
  logStore.clearLogs()
  if (deviceStore.activeDevice) {
    window.electronAPI.log.clear(deviceStore.activeDevice)
  }
}

async function onExport() {
  const filePath = await window.electronAPI.storage.export(deviceStore.activeDevice || undefined, {
    defaultPath: configStore.fileSavePath || undefined,
    logs: logStore.filteredLogs
  })
  if (filePath) {
    ElMessage.success(`已导出到 ${filePath}`)
  }
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--toolbar-height);
  padding: 0 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.toolbar-left, .toolbar-center, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.app-title {
  font-weight: 700;
  font-size: 15px;
  color: var(--accent);
  letter-spacing: 0.5px;
  margin-right: 4px;
}
.setting-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  line-height: 1.2;
}
.setting-desc a {
  color: var(--accent);
  text-decoration: none;
}
</style>
