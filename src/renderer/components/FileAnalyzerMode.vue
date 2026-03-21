<template>
  <div class="file-analyzer-mode">
    <el-tabs 
      v-model="activeTab" 
      type="border-card" 
      class="workspace-tabs" 
      @tab-remove="handleTabRemove"
    >
      <el-tab-pane 
        v-for="fileTab in openLocalFiles" 
        :key="fileTab.id" 
        :name="fileTab.id" 
        closable
      >
        <template #label>
          <span class="tab-label" :title="fileTab.name">
            {{ fileTab.name }}
          </span>
        </template>
        <LocalFileTab :file="fileTab" @reload="reloadLocalFile" />
      </el-tab-pane>

      <!-- Welcome screen when no tabs are open -->
      <div v-if="openLocalFiles.length === 0" class="welcome-screen">
        <div class="welcome-card glass">
          <el-icon :size="48" class="welcome-icon"><Document /></el-icon>
          <h2>离线日志分析</h2>
          <p>导入本地日志文件进行深度检索与多维比对</p>
          <el-button type="primary" size="large" @click="openLocalFileInTab" class="welcome-btn">
            立即打开文件
          </el-button>
        </div>
      </div>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import LocalFileTab from './LocalFileTab.vue'

const activeTab = ref('')
const openLocalFiles = ref<{ 
  id: string, 
  name: string, 
  path: string, 
  lines: string[], 
  loading: boolean
}[]>([])
let tabCounter = 1

function handleTabRemove(targetName: any) {
  const tabs = openLocalFiles.value
  let activeName = activeTab.value
  if (activeName === targetName) {
    tabs.forEach((tab, index) => {
      if (tab.id === targetName) {
        const nextTab = tabs[index + 1] || tabs[index - 1]
        if (nextTab) {
          activeName = nextTab.id
        } else {
          activeName = ''
        }
      }
    })
  }
  activeTab.value = activeName
  openLocalFiles.value = tabs.filter((tab) => tab.id !== targetName)
}

async function openLocalFileInTab() {
  try {
    const result = await window.electronAPI.storage.openLocalFile()
    if (result) {
      const existingTab = openLocalFiles.value.find(t => t.path === result.path)
      if (existingTab) {
        activeTab.value = existingTab.id
        return
      }

      const lines = result.content.split('\n')
      const newTabId = `tab-${tabCounter++}`
      
      openLocalFiles.value.push({
        id: newTabId,
        name: result.name,
        path: result.path,
        lines: lines,
        loading: false
      })
      activeTab.value = newTabId
    }
  } catch (e: any) {
    ElMessage.error(e.message || '读取本地文件失败')
  }
}

async function reloadLocalFile(tabId: string) {
  const tab = openLocalFiles.value.find(t => t.id === tabId)
  if (!tab) return
  openLocalFileInTab()
}

defineExpose({
  openFile: openLocalFileInTab
})
</script>

<style scoped>
.file-analyzer-mode {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

.workspace-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: none !important;
  background: transparent !important;
}

.tab-label {
  display: inline-block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

:deep(.el-tabs__header) {
  background: var(--bg-secondary) !important;
  border-bottom: 1px solid var(--border-color) !important;
  margin: 0 !important;
}

:deep(.el-tabs__item) {
  height: 36px !important;
  line-height: 36px !important;
  color: var(--text-muted) !important;
  border: none !important;
  border-right: 1px solid var(--border-color) !important;
  transition: all 0.2s ease !important;
  padding: 0 16px !important;
}

:deep(.el-tabs__item.is-active) {
  color: var(--accent) !important;
  background: var(--bg-primary) !important;
}

:deep(.el-tabs__nav-wrap) {
  margin-bottom: 0 !important;
}

:deep(.el-tabs__content) {
  flex: 1;
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary) !important;
}

.welcome-screen {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  padding-bottom: 60px;
}

.welcome-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
  border-radius: 24px;
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.welcome-icon {
  color: var(--accent);
  margin-bottom: 24px;
  opacity: 0.8;
}

.welcome-screen h2 {
  margin: 0 0 12px 0;
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 600;
}

.welcome-screen p {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 32px 0;
  line-height: 1.5;
}

.welcome-btn {
  padding: 12px 32px;
  border-radius: 12px;
  font-weight: 500;
}
</style>

<style>
.file-analyzer-mode .el-tabs__content {
  flex: 1;
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
.file-analyzer-mode .el-tab-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  min-height: 0;
}
</style>
