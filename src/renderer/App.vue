<template>
  <div v-if="isScreenshotPage" class="standalone-window">
    <ScreenshotView />
  </div>
  <div v-else id="app-container">
    <CustomTitleBar 
      :current-mode="currentAppMode" 
      @open-settings="openSettingsTab" 
      @change-mode="switchMode" 
    />

    <div class="main-content">
      <!-- We use simple v-if/v-else-if to ensure absolute stability and destruction of components -->
      <HomeMode 
        v-if="currentAppMode === 'home'" 
        @select-mode="switchMode" 
        @open-settings="openSettingsTab" 
      />
      
      <LiveLogMode 
        v-else-if="currentAppMode === 'live'" 
        @open-settings="openSettingsTab" 
      />
      
      <FileAnalyzerMode 
        v-else-if="currentAppMode === 'file'" 
        ref="fileAnalyzerRef" 
      />
      
      <ChatMode 
        v-else-if="currentAppMode === 'chat'" 
        @select-mode="switchMode" 
      />
      
      <PerfMode 
        v-else-if="currentAppMode === 'perf'" 
        @select-mode="switchMode" 
      />
    </div>
    
    <StatusBar v-if="currentAppMode === 'live' || currentAppMode === 'perf'" />

    <SystemSettingsDialog ref="systemSettingsRef" />
    <FileExplorerDialog ref="fileExplorerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useDeviceStore } from './stores/deviceStore'
import { useConfigStore } from './stores/configStore'
import StatusBar from './components/StatusBar.vue'
import SystemSettingsDialog from './components/SystemSettingsDialog.vue'
import CustomTitleBar from './components/CustomTitleBar.vue'
import FileExplorerDialog from './components/FileExplorerDialog.vue'
import LiveLogMode from './components/LiveLogMode.vue'
import FileAnalyzerMode from './components/FileAnalyzerMode.vue'
import HomeMode from './components/HomeMode.vue'
import ChatMode from './components/ChatMode.vue'
import PerfMode from './components/PerfMode.vue'
import ScreenshotView from './views/ScreenshotView.vue'

const deviceStore = useDeviceStore()
const configStore = useConfigStore()

const currentHash = ref(window.location.hash)
const isScreenshotPage = computed(() => currentHash.value.startsWith('#screenshot'))

const currentAppMode = ref<'home' | 'live' | 'file' | 'perf' | 'chat'>('home')

const systemSettingsRef = ref<InstanceType<typeof SystemSettingsDialog> | null>(null)
const fileExplorerRef = ref<InstanceType<typeof FileExplorerDialog> | null>(null)
const fileAnalyzerRef = ref<InstanceType<typeof FileAnalyzerMode> | null>(null)

function switchMode(mode: 'home' | 'live' | 'file' | 'perf' | 'chat') {
  currentAppMode.value = mode
}

function openSettingsTab(tab: string) {
  if (tab === 'ai' || tab === 'general') {
    if (systemSettingsRef.value) {
      systemSettingsRef.value.open()
    }
  } else if (tab === 'explorer' && fileExplorerRef.value) {
    fileExplorerRef.value.open()
  } else if (tab === 'local-file') {
    switchMode('file')
    setTimeout(() => {
      if (fileAnalyzerRef.value) {
        fileAnalyzerRef.value.openFile()
      }
    }, 100)
  }
}

onMounted(async () => {
  window.addEventListener('hashchange', () => {
    currentHash.value = window.location.hash
  })

  if (isScreenshotPage.value) return

  await deviceStore.fetchDevices()

  if (window.electronAPI?.config?.onOpenSettings) {
    window.electronAPI.config.onOpenSettings((tab: string) => {
      openSettingsTab(tab || 'ai')
    })
  }
})
</script>

<style>
#app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  overflow: hidden;
  border: none !important;
}

.standalone-window {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-primary);
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: var(--bg-primary);
}

.el-tabs, .el-tabs__header, .el-tabs__content, .el-tabs__nav-wrap {
  border: none !important;
  box-shadow: none !important;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: transparent !important;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1) !important;
  border-radius: 10px;
  border: 2px solid transparent;
  background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2) !important;
  background-clip: content-box;
}

body {
  margin: 0;
  padding: 0;
  background: var(--bg-primary);
  overflow: hidden;
}
</style>