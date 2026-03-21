<template>
  <div class="device-panel">
    <div class="panel-header">
      <span class="header-title">设备列表</span>
      <el-button 
        type="primary" 
        link 
        :icon="Plus" 
        @click="showWifiDialog = true"
        class="wifi-connect-btn"
        title="无线连接"
      ></el-button>
    </div>
    <div class="device-list">
      <div
        v-for="device in deviceStore.devices"
        :key="device.serial"
        class="device-item"
        :class="{ active: deviceStore.activeDevice === device.serial }"
        @click="deviceStore.setActiveDevice(device.serial)"
      >
        <div class="status-indicator">
          <span class="status-dot" :class="device.status" />
        </div>
        <div class="device-info">
          <div class="device-model">{{ device.model || 'Unknown Device' }}</div>
          <div class="device-serial">{{ device.serial }}</div>
        </div>
        <el-icon v-if="device.type === 'wifi'" class="wifi-status-icon"><Connection /></el-icon>
      </div>
      <div v-if="!deviceStore.devices.length" class="empty-state">
        <el-icon><InfoFilled /></el-icon>
        <p>暂无设备连接</p>
      </div>
    </div>

    <el-dialog
      v-model="showWifiDialog"
      title="无线 ADB 连接"
      width="420px"
      :append-to-body="true"
      align-center
      class="wifi-dialog"
    >
      <div class="wifi-guide">
        <div class="guide-item">
          <span class="guide-num">1</span>
          <p>确保手机与电脑处于<b>同一局域网</b></p>
        </div>
        <div class="guide-item">
          <span class="guide-num">2</span>
          <p>在手机开发者选项中开启<b>「无线调试」</b></p>
        </div>
      </div>
      
      <div class="wifi-form">
        <div class="form-row">
          <div class="form-label">IP 地址</div>
          <el-input v-model="wifiIp" placeholder="192.168.x.x" spellcheck="false" />
        </div>
        <div class="form-row">
          <div class="form-label">端口号</div>
          <el-input v-model="wifiPort" placeholder="5555" spellcheck="false" />
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="onConnectWifi" :loading="connecting" class="dialog-btn primary">
            立即连接
          </el-button>
          <el-button @click="showWifiDialog = false" class="dialog-btn">
            取消
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Connection, InfoFilled } from '@element-plus/icons-vue'
import { useDeviceStore } from '../stores/deviceStore'

const deviceStore = useDeviceStore()
const showWifiDialog = ref(false)
const wifiIp = ref('')
const wifiPort = ref('')
const connecting = ref(false)

async function onConnectWifi() {
  if (!wifiIp.value) {
    ElMessage.warning('请输入 IP 地址')
    return
  }
  connecting.value = true
  try {
    const port = parseInt(wifiPort.value) || 5555
    await deviceStore.connectWifi(wifiIp.value, port)
    showWifiDialog.value = false
    wifiIp.value = ''
    wifiPort.value = ''
  } finally {
    connecting.value = false
  }
}
</script>

<style scoped>
.device-panel {
  flex: 1;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Panel Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.header-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: none;
}
.wifi-connect-btn {
  color: var(--text-muted) !important;
  font-size: 18px;
  padding: 4px;
  height: 28px;
  width: 28px;
  border-radius: 6px;
  transition: all 0.2s;
  background: transparent !important;
}
.wifi-connect-btn:hover {
  color: var(--accent) !important;
  background: var(--bg-hover) !important;
}

/* Device List */
.device-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.device-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  border-left: 3px solid transparent;
}
.device-item:hover {
  background: var(--bg-hover);
}
.device-item.active {
  background: var(--accent-soft);
  border-left-color: var(--accent);
}

.device-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.device-model {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.device-item.active .device-model {
  color: var(--accent);
}
.device-serial {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
}
.device-item.active .device-serial {
  color: var(--text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: block;
}
.status-dot.device { background: var(--success); box-shadow: 0 0 8px rgba(158, 206, 106, 0.4); }
.status-dot.offline { background: var(--text-muted); }
.status-dot.unauthorized { background: var(--warning); }

.wifi-status-icon {
  font-size: 13px;
  color: var(--text-muted);
  opacity: 0.6;
}
.device-item.active .wifi-status-icon {
  color: var(--accent);
  opacity: 1;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}
.empty-state .el-icon { 
  font-size: 40px; 
  margin-bottom: 16px; 
  color: var(--text-muted);
}
.empty-state p {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

/* Dialog Styling */
.wifi-guide {
  background: var(--bg-surface);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  margin-bottom: 24px;
}
.guide-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.guide-item:last-child { margin-bottom: 0; }
.guide-num {
  width: 18px;
  height: 18px;
  background: var(--accent);
  color: var(--bg-primary);
  border-radius: 50%;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.guide-item p { margin: 0; font-size: 13px; color: var(--text-secondary); }
.guide-item b { color: var(--text-primary); }

.wifi-form :deep(.el-input__inner::placeholder) {
  font-style: italic;
  color: var(--text-muted);
  opacity: 0.6;
}
.wifi-form { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

.dialog-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
}
.dialog-btn {
  width: 140px;
  height: 36px;
  font-weight: 600;
  border-radius: 6px;
  transition: all 0.2s;
}
.dialog-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(122, 162, 247, 0.3);
}

:deep(.wifi-dialog) {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 12px !important;
}
:deep(.wifi-dialog .el-dialog__title) { font-weight: 700; color: var(--text-primary); }
</style>