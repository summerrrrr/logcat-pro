<template>
  <el-dialog v-model="visible" title="设备文件浏览器" width="900px" top="5vh" append-to-body destroy-on-close class="file-explorer-dialog">
    <div class="explorer-layout">
      <!-- Left: File Browser -->
      <div class="explorer-sidebar">
        <div class="path-nav">
          <el-button size="small" :icon="ArrowLeft" circle @click="navigateUp" :disabled="currentPath === '/'" />
          <el-input 
            v-model="inputPath" 
            size="small" 
            placeholder="/sdcard" 
            @keyup.enter="loadDirectory(inputPath)"
          >
            <template #append>
              <el-button :icon="Right" @click="loadDirectory(inputPath)" />
            </template>
          </el-input>
        </div>
        
        <div class="file-list" v-loading="loadingDir">
          <div 
            v-for="file in files" 
            :key="file.name"
            class="file-item"
            :class="{ active: selectedFile === file.name }"
            @click="onFileClick(file)"
          >
            <el-icon class="file-icon" :class="{ 'is-dir': file.isDir }">
              <Folder v-if="file.isDir" />
              <Document v-else />
            </el-icon>
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size" v-if="!file.isDir">{{ formatSize(file.size) }}</span>
          </div>
          <div v-if="files.length === 0 && !loadingDir" class="empty-dir">
            空目录或无权限访问
          </div>
        </div>
      </div>

      <!-- Right: File Viewer -->
      <div class="explorer-main">
        <div class="viewer-header" v-if="selectedFile && !selectedIsDir">
          <span>{{ currentPath === '/' ? '' : currentPath }}/{{ selectedFile }}</span>
          <el-button size="small" type="primary" link @click="reloadFile" :loading="loadingFile">刷新</el-button>
        </div>
        <div class="viewer-content" v-loading="loadingFile">
          <div v-if="!selectedFile || selectedIsDir" class="viewer-placeholder">
            <el-icon :size="48" color="var(--text-muted)"><Document /></el-icon>
            <p>选择一个文件进行预览</p>
          </div>
          <pre v-else class="file-text">{{ fileContent }}</pre>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Folder, Document, ArrowLeft, Right } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useDeviceStore } from '../stores/deviceStore'

const deviceStore = useDeviceStore()
const visible = ref(false)

const currentPath = ref('/sdcard')
const inputPath = ref('/sdcard')
const files = ref<{ name: string, isDir: boolean, size: number, date: string }[]>([])
const loadingDir = ref(false)

const selectedFile = ref('')
const selectedIsDir = ref(false)
const fileContent = ref('')
const loadingFile = ref(false)

defineExpose({
  open: () => {
    if (!deviceStore.activeDevice) {
      ElMessage.warning('请先选择并连接一个 Android 设备')
      return
    }
    visible.value = true
    loadDirectory('/sdcard')
  }
})

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function navigateUp() {
  if (currentPath.value === '/') return
  const parts = currentPath.value.split('/').filter(Boolean)
  parts.pop()
  const upPath = '/' + parts.join('/')
  loadDirectory(upPath)
}

async function loadDirectory(targetPath: string) {
  if (!deviceStore.activeDevice) return
  
  // ensure valid path format
  if (!targetPath.startsWith('/')) targetPath = '/' + targetPath
  if (targetPath.length > 1 && targetPath.endsWith('/')) targetPath = targetPath.slice(0, -1)
  
  loadingDir.value = true
  try {
    const list = await window.electronAPI.device.listDir(deviceStore.activeDevice, targetPath)
    files.value = list
    currentPath.value = targetPath
    inputPath.value = targetPath
    selectedFile.value = ''
    fileContent.value = ''
  } catch (e: any) {
    ElMessage.error(`读取目录失败: ${e.message}`)
  } finally {
    loadingDir.value = false
  }
}

async function onFileClick(file: { name: string, isDir: boolean }) {
  if (file.isDir) {
    const nextPath = currentPath.value === '/' ? `/${file.name}` : `${currentPath.value}/${file.name}`
    loadDirectory(nextPath)
  } else {
    selectedFile.value = file.name
    selectedIsDir.value = false
    loadFileContent()
  }
}

async function reloadFile() {
  loadFileContent()
}

async function loadFileContent() {
  if (!deviceStore.activeDevice || !selectedFile.value) return
  
  const fullPath = currentPath.value === '/' ? `/${selectedFile.value}` : `${currentPath.value}/${selectedFile.value}`
  loadingFile.value = true
  fileContent.value = ''
  
  try {
    const content = await window.electronAPI.device.readFile(deviceStore.activeDevice, fullPath)
    fileContent.value = content
  } catch (e: any) {
    fileContent.value = `[Error reading file]\n\nPossible reasons:\n1. Permission denied (requires root for some /data/ files).\n2. File is binary or too large.\n\nRaw error: ${e.message}`
  } finally {
    loadingFile.value = false
  }
}
</script>

<style scoped>
.explorer-layout {
  display: flex;
  height: 65vh;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  margin: -20px -20px 0 -20px; /* Offset element-plus dialog padding */
}

.explorer-sidebar {
  width: 300px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.path-nav {
  display: flex;
  padding: 8px;
  gap: 8px;
  border-bottom: 1px solid var(--border-color);
}

.file-list {
  flex: 1;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  user-select: none;
}
.file-item:hover {
  background: var(--bg-hover);
}
.file-item.active {
  background: var(--bg-surface);
}

.file-icon {
  margin-right: 8px;
  font-size: 16px;
}
.file-icon.is-dir {
  color: var(--accent);
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 11px;
  color: var(--text-muted);
}

.empty-dir {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.explorer-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  min-width: 0; /* Important for flex child to truncate text properly */
}

.viewer-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.viewer-content {
  flex: 1;
  overflow: auto;
  position: relative;
}

.viewer-placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}
.viewer-placeholder p {
  color: var(--text-muted);
  margin-top: 12px;
}

.file-text {
  margin: 0;
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
}

/* Custom scrollbar for this dialog */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-thumb {
  background: var(--bg-hover);
  border-radius: 4px;
}
</style>

<style>
/* Global override for this dialog specifically */
.file-explorer-dialog .el-dialog__body {
  padding: 0;
}
</style>
