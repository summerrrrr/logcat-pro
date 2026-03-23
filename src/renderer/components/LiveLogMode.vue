<template>
  <div class="live-log-mode">
    <aside class="sidebar" :style="{ width: sidebarWidth + 'px' }">
      <DevicePanel />
    </aside>
    <div
      class="resize-handle-v"
      @mousedown="onSidebarResizeStart"
    />
    
    <!-- Vertical Toolbar -->
    <div v-if="deviceStore.activeDevice" class="toolbar-v">
      <!-- Device Actions -->
      <el-tooltip content="设备截图" placement="right">
        <div class="tool-btn" @click="onScreenshot">
          <el-icon><Camera /></el-icon>
        </div>
      </el-tooltip>
      <el-tooltip content="重启设备" placement="right">
        <div class="tool-btn" @click="onReboot">
          <el-icon><RefreshRight /></el-icon>
        </div>
      </el-tooltip>
      <el-tooltip content="关机" placement="right">
        <div class="tool-btn danger" @click="onShutdown">
          <el-icon><SwitchButton /></el-icon>
        </div>
      </el-tooltip>

      <div class="divider-v"></div>

      <!-- Log Actions (Unified States) -->
      <el-tooltip :content="logStore.isCollecting ? '停止抓取' : '开始抓取'" placement="right">
        <div 
          class="tool-btn" 
          :class="logStore.isCollecting ? 'stop-active' : 'start-ready'"
          @click="toggleCollection"
        >
          <el-icon v-if="!logStore.isCollecting"><VideoPlay /></el-icon>
          <el-icon v-else><Remove /></el-icon>
        </div>
      </el-tooltip>

      <el-tooltip content="清空日志" placement="right">
        <div class="tool-btn" :class="{ disabled: !logStore.logs.length }" @click="onClear">
          <el-icon><Delete /></el-icon>
        </div>
      </el-tooltip>

      <el-tooltip content="导出日志" placement="right">
        <div class="tool-btn" :class="{ disabled: logStore.isCollecting || !logStore.logs.length }" @click="onExport">
          <el-icon><Download /></el-icon>
        </div>
      </el-tooltip>
    </div>

    <main class="workspace">
      <div v-if="deviceStore.activeDevice" class="live-log-container">
        <div class="filter-bar">
          <FilterPanel @open-settings="tab => emit('open-settings', tab)" />
        </div>
        <LogView />
        <div
          class="resize-handle"
          @mousedown="onResizeStart"
        />
        <div class="bottom-panels" :style="{ height: bottomHeight + 'px' }">
          <div class="detail-panel" v-if="logStore.selectedLog">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div class="detail-row"><span class="detail-label">时间:</span> {{ logStore.selectedLog.timestamp }}</div>
              <div class="detail-actions">
                <el-button 
                  type="primary" 
                  size="small" 
                  :loading="isAnalyzing"
                  v-if="['E', 'F', 'W'].includes(logStore.selectedLog.level)"
                  @click="onAnalyzeLog"
                >
                  <el-icon><MagicStick /></el-icon> AI 诊断
                </el-button>
              </div>
            </div>
            <div class="detail-row"><span class="detail-label">级别:</span> {{ logStore.selectedLog.level }}</div>
            <div class="detail-row"><span class="detail-label">PID/TID:</span> {{ logStore.selectedLog.pid }} / {{ logStore.selectedLog.tid }}</div>
            <div class="detail-row"><span class="detail-label">标签:</span> {{ logStore.selectedLog.tag }}</div>
            <div class="detail-row detail-message">
              <span class="detail-label">消息:</span>
              <pre>{{ logStore.selectedLog.message }}</pre>
            </div>
            <div class="detail-row"><span class="detail-label">原始日志:</span><pre class="detail-raw">{{ logStore.selectedLog.raw }}</pre></div>
          </div>
          <div class="detail-panel empty" v-else>
            <el-icon class="empty-icon"><InfoFilled /></el-icon>
            <p>选择一条日志查看详细信息</p>
          </div>
        </div>
      </div>
      <div v-else class="welcome-panel">
        <div class="welcome-content">
          <el-icon class="welcome-icon"><Monitor /></el-icon>
          <h2>等待设备连接</h2>
          <p>请通过以下方式之一连接您的 Android 设备：</p>
          <div class="step-cards">
            <div class="step-card">
              <h4>USB 连接</h4>
              <ul>
                <li>开启设备 <b>开发者选项</b></li>
                <li>启用 <b>USB 调试</b></li>
                <li>使用 USB 线缆连接电脑</li>
              </ul>
            </div>
            <div class="step-card">
              <h4>无线连接</h4>
              <ul>
                <li>确保设备与电脑在 <b>同一网络</b></li>
                <li>在左侧列表中点击 <b>无线连接</b></li>
                <li>输入设备 IP 地址进行连接</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script lang="ts">
export default {
  name: 'LiveLogMode'
}
</script>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { 
  MagicStick, Monitor, Cpu, Connection, Camera, RefreshRight, 
  SwitchButton, VideoPlay, Remove, Delete, Download, InfoFilled
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { useLogStore } from '../stores/logStore'
import { useDeviceStore } from '../stores/deviceStore'
import { useConfigStore } from '../stores/configStore'
import DevicePanel from './DevicePanel.vue'
import FilterPanel from './FilterPanel.vue'
import LogView from '../views/LogView.vue'

const logStore = useLogStore()
const deviceStore = useDeviceStore()
const configStore = useConfigStore()
const bottomHeight = ref(200)
const sidebarWidth = ref(200)

const emit = defineEmits(['open-settings'])

const isAnalyzing = ref(false)

async function onAnalyzeLog() {
  const log = logStore.selectedLog
  if (!log) return
  ElMessage.info('AI 分析功能暂未在此重置版中完全开启')
}

async function onScreenshot() {
  const serial = deviceStore.activeDevice
  if (!serial) return
  const loading = ElLoading.service({
    lock: true,
    text: '正在获取设备截图...',
    background: 'rgba(0, 0, 0, 0.7)'
  })
  try {
    const data = await window.electronAPI.device.screenshot(serial)
    window.electronAPI.window.openScreenshotWindow(data, serial)
  } catch (e: any) {
    ElMessage.error(`截图失败: ${e.message}`)
  } finally {
    loading.close()
  }
}

async function onReboot() {
  const serial = deviceStore.activeDevice
  if (!serial) return
  try {
    await ElMessageBox.confirm('确认要重启设备吗？', '提示', { confirmButtonText: '重启', cancelButtonText: '取消' })
    await window.electronAPI.device.reboot(serial)
    ElMessage.success('重启指令已发送')
  } catch (e: any) {}
}

async function onShutdown() {
  const serial = deviceStore.activeDevice
  if (!serial) return
  try {
    await ElMessageBox.confirm('确认要关闭设备吗？', '提示', { confirmButtonText: '关机', cancelButtonText: '取消' })
    await window.electronAPI.device.shutdown(serial)
    ElMessage.success('关机指令已发送')
  } catch (e: any) {}
}

async function toggleCollection() {
  const serial = deviceStore.activeDevice
  if (!serial) return
  if (logStore.isCollecting) {
    await logStore.stopCollection(serial)
  } else {
    logStore.selectLog(null)
    await logStore.startCollection(serial)
  }
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
    ElMessage.success(`已导出`)
  }
}

function onResizeStart(e: MouseEvent) {
  e.preventDefault()
  const startY = e.clientY
  const startHeight = bottomHeight.value
  const onMouseMove = (ev: MouseEvent) => {
    const delta = startY - ev.clientY
    bottomHeight.value = Math.max(100, Math.min(600, startHeight + delta))
  }
  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onSidebarResizeStart(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  const onMouseMove = (ev: MouseEvent) => {
    const delta = ev.clientX - startX
    sidebarWidth.value = Math.max(200, Math.min(500, startWidth + delta))
  }
  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

onUnmounted(async () => {
  const serial = deviceStore.activeDevice
  if (serial) { await logStore.stopCollection(serial) }
  deviceStore.stopWatching()
  logStore.clearLogs()
})

onMounted(async () => {
  logStore.clearLogs()
  await deviceStore.fetchDevices()
  await deviceStore.startWatching()
})
</script>

<style scoped>
.live-log-mode { display: flex; flex: 1; overflow: hidden; }
.sidebar { display: flex; flex-direction: column; border-right: 1px solid var(--border-color); background: var(--bg-secondary); overflow: hidden; }

/* Unified Toolbar Styling */
.toolbar-v {
  width: 44px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 12px;
}
.divider-v { width: 24px; height: 1px; background: var(--border-color); margin: 4px 0; }

.tool-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.tool-btn .el-icon { font-size: 20px; }

/* Default Hover */
.tool-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* Start Ready State (Green) */
.tool-btn.start-ready { color: var(--success); }
.tool-btn.start-ready:hover { background: rgba(158, 206, 106, 0.15); color: #b8e086; }

/* Stop Active State (Red Glow) */
.tool-btn.stop-active { color: var(--danger); background: var(--danger-dim); }
.tool-btn.stop-active:hover { background: rgba(247, 118, 142, 0.2); filter: brightness(1.2); }

/* Other Special States */
.tool-btn.danger:hover { background: var(--danger-dim); color: var(--danger); }
.tool-btn.disabled { opacity: 0.2; cursor: not-allowed; pointer-events: none; }

.resize-handle-v { width: 1px; cursor: col-resize; background: var(--border-color); position: relative; z-index: 10; flex-shrink: 0; }
.resize-handle-v::after { content: ''; position: absolute; top: 0; bottom: 0; left: -3px; right: -3px; }

.workspace { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-primary); }
.live-log-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.bottom-panels { border-top: 1px solid var(--border-color); background: var(--bg-secondary); overflow: auto; }
.resize-handle { height: 1px; cursor: row-resize; background: var(--border-color); position: relative; z-index: 10; }
.resize-handle::after { content: ''; position: absolute; left: 0; right: 0; top: -3px; bottom: -3px; }

.detail-panel { padding: 12px; font-size: 13px; font-family: var(--font-mono); }
.detail-panel.empty { color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; }
.empty-icon { font-size: 32px; color: var(--accent); opacity: 0.5; }
.detail-row { margin-bottom: 4px; }
.detail-label { color: var(--text-secondary); font-weight: 600; }
.detail-message pre, .detail-raw { white-space: pre-wrap; word-break: break-all; margin-top: 2px; padding: 4px; background: var(--bg-surface); border-radius: 4px; font-size: 12px; }

.welcome-panel { flex: 1; display: flex; align-items: center; justify-content: center; background: var(--bg-primary); padding: 40px; }
.welcome-content { max-width: 700px; text-align: center; }
.welcome-icon { font-size: 64px; color: var(--text-muted); margin-bottom: 24px; opacity: 0.4; }
.welcome-content h2 { font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
.welcome-content p { color: var(--text-secondary); font-size: 14px; margin-bottom: 48px; }
.step-cards { display: flex; gap: 24px; justify-content: center; }
.step-card { flex: 1; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 32px 24px; text-align: left; transition: all 0.3s ease; min-width: 260px; }
.step-card:hover { border-color: var(--accent); background: var(--bg-surface); transform: translateY(-4px); }
.step-card h4 { font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0 0 12px 0; }
.step-card ul { margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
.step-card ul li { margin-bottom: 8px; }
.step-card b { color: var(--accent); font-weight: 600; }
</style>