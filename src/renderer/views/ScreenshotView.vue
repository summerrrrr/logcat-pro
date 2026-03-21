<template>
  <div class="screenshot-view">
    <!-- Custom Title Bar for standalone window -->
    <div class="custom-titlebar">
      <div class="titlebar-left">
        <el-icon><Camera /></el-icon>
        <span class="module-title">设备截图 - {{ serial }}</span>
      </div>
      <div class="titlebar-center"></div>
      <div class="titlebar-right no-drag">
        <div class="window-btn" @click="maximize">
          <el-icon><FullScreen v-if="!isMaximized" /><CopyDocument v-else /></el-icon>
        </div>
        <div class="window-btn close-btn" @click="handleClose">
          <el-icon><Close /></el-icon>
        </div>
      </div>
    </div>

    <div class="screenshot-header">
      <div class="header-info">
        <el-icon><Picture /></el-icon>
        <span>预览</span>
      </div>
      <el-button type="primary" size="small" @click="saveScreenshot">
        <el-icon><Download /></el-icon> 保存到本地
      </el-button>
    </div>
    <div class="screenshot-body">
      <div class="image-container">
        <img :src="screenshotData" alt="Device Screenshot" class="screenshot-img" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Picture, Download, Camera, Minus, FullScreen, CopyDocument, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useConfigStore } from '../stores/configStore'

const configStore = useConfigStore()
const screenshotData = ref('')
const serial = ref('')
const isMaximized = ref(false)
let removeListener: (() => void) | null = null

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1])
  screenshotData.value = decodeURIComponent(urlParams.get('data') || '')
  serial.value = urlParams.get('serial') || 'Unknown'

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

function handleClose() {
  window.electronAPI.window.close()
}

async function saveScreenshot() {
  if (!screenshotData.value) return
  
  try {
    const filePath = await window.electronAPI.storage.saveScreenshot(
      screenshotData.value, 
      serial.value, 
      configStore.fileSavePath
    )
    if (filePath) {
      ElMessage.success('截图已保存')
    }
  } catch (error: any) {
    ElMessage.error(`保存失败: ${error.message}`)
  }
}
</script>

<style scoped>
.screenshot-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0f1117;
  color: #c0caf5;
  overflow: hidden;
}

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
  gap: 8px;
}

.module-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.titlebar-center {
  flex: 1;
  -webkit-app-region: drag;
  height: 100%;
}

.titlebar-right {
  display: flex;
}

.no-drag {
  -webkit-app-region: no-drag;
}

.window-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 46px;
  height: 32px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.2s;
}

.window-btn:hover {
  background: var(--bg-hover);
}

.window-btn.close-btn:hover {
  background: #e81123;
  color: white;
}

.screenshot-header {
  height: 48px;
  background: #161922;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}

.screenshot-body {
  flex: 1;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}

.image-container {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.screenshot-img {
  max-width: 100%;
  max-height: 100%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  border-radius: 4px;
}
</style>