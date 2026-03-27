<template>
  <div class="auto-test-mode">
    <div class="test-container glass">
      <div class="test-header">
        <h2>视觉UI自动化测试</h2>
      </div>

      <!-- 设备和应用选择 -->
      <div class="device-selector glass">
        <el-form :inline="true">
          <el-form-item label="测试设备">
            <el-select v-model="selectedDevice" placeholder="选择设备" style="width: 200px">
              <el-option
                v-for="device in deviceStore.devices"
                :key="device"
                :label="getDeviceName(device)"
                :value="device"
              />
            </el-select>
            <el-button size="small" @click="refreshDevices" style="margin-left: 8px">
              刷新
            </el-button>
          </el-form-item>
          <el-form-item label="目标应用">
            <el-select
              v-model="targetPackage"
              placeholder="选择应用"
              filterable
              style="width: 300px"
              :loading="loadingApps"
            >
              <el-option
                v-for="app in appList"
                :key="app.package"
                :label="`${app.name} (${app.package})`"
                :value="app.package"
              />
            </el-select>
            <el-button size="small" @click="loadApps" :disabled="!selectedDevice" style="margin-left: 8px">
              刷新应用
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="test-list">
        <div v-for="test in testCases" :key="test.id" class="test-item glass">
          <div class="test-info">
            <h3>{{ test.name }}</h3>
            <p>{{ test.description }}</p>
          </div>
          <el-button
            type="primary"
            :loading="runningTests.has(test.id)"
            @click="runTest(test)"
          >
            {{ runningTests.has(test.id) ? '运行中...' : '运行测试' }}
          </el-button>
        </div>
      </div>

      <!-- 测试执行日志 -->
      <div v-if="testLogs.length > 0" class="test-logs glass">
        <h3>执行日志</h3>
        <div class="log-lines">
          <div v-for="(log, i) in testLogs" :key="i" class="log-line">{{ log }}</div>
        </div>
      </div>

      <div v-if="currentResult" class="test-result glass">
        <h3>测试结果</h3>
        <div :class="['result-status', currentResult.passed ? 'success' : 'failed']">
          {{ currentResult.passed ? '通过' : '失败' }}
        </div>
        <p>耗时: {{ currentResult.duration }}ms</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useDeviceStore } from '../stores/deviceStore'
import { useConfigStore } from '../stores/configStore'
import type { TestResult } from '../test-automation/core/types'

const deviceStore = useDeviceStore()
const configStore = useConfigStore()

const showSettings = ref(false)
const selectedDevice = ref('')

// 监听设备选择变化，自动刷新应用列表
watch(selectedDevice, (newDevice) => {
  if (newDevice) {
    loadApps()
  }
})

// 当前激活的 AI 提供商名称
const activeProviderName = computed(() => {
  const provider = configStore.aiProviders.find(p => p.id === configStore.activeAIProviderId)
  return provider ? `${provider.name} (${provider.model})` : ''
})
const targetPackage = ref('')
const loadingApps = ref(false)
const appList = ref<Array<{ package: string; name: string }>>([])
const runningTests = ref(new Set<string>())
const currentResult = ref<TestResult | null>(null)

let removeLogListener: (() => void) | null = null

onMounted(async () => {
  // 启动设备监听
  if (!deviceStore.isWatching) {
    await deviceStore.startWatching()
  }

  // 监听测试日志
  if (window.electronAPI.visualTest?.onLog) {
    removeLogListener = window.electronAPI.visualTest.onLog((msg: string) => {
      addLog(msg)
    })
  }
})

async function refreshDevices() {
  await deviceStore.startWatching()
}

async function loadApps() {
  if (!selectedDevice.value) return

  loadingApps.value = true
  try {
    // 提取设备 serial
    const serial = typeof selectedDevice.value === 'object'
      ? selectedDevice.value.serial
      : selectedDevice.value

    const packages = await window.electronAPI.device.listPackages(serial)
    appList.value = packages
      .map((pkg: string) => ({
        package: pkg,
        name: pkg.split('.').pop() || pkg
      }))
      .sort((a, b) => {
        // 优先显示 com.iflyrec 和 com.iflytek 开头的应用
        const aIsTarget = a.package.startsWith('com.iflyrec') || a.package.startsWith('com.iflytek')
        const bIsTarget = b.package.startsWith('com.iflyrec') || b.package.startsWith('com.iflytek')
        if (aIsTarget && !bIsTarget) return -1
        if (!aIsTarget && bIsTarget) return 1
        return a.package.localeCompare(b.package)
      })
  } catch (error) {
    console.error('加载应用列表失败:', error)
  } finally {
    loadingApps.value = false
  }
}

function getDeviceName(device: any): string {
  // 如果是对象，返回 serial 或 model
  if (typeof device === 'object') {
    return device.serial || device.model || String(device)
  }
  // 如果是字符串，提取第一部分
  return String(device).split(' ')[0]
}

const testCases = [
  {
    id: 'crash-001',
    name: '稳定性测试',
    description: '随机点击和滑动操作，检测应用是否崩溃'
  }
]

function getSerial(): string {
  if (typeof selectedDevice.value === 'object') {
    return (selectedDevice.value as any).serial
  }
  return String(selectedDevice.value)
}

async function runTest(test: typeof testCases[0]) {
  if (!selectedDevice.value || !targetPackage.value) {
    ElMessage.warning('请先选择设备和目标应用')
    return
  }

  const serial = getSerial()
  runningTests.value.add(test.id)
  currentResult.value = null
  testLogs.value = []

  try {
    // 复用首页设置中的 AI 配置
    const provider = configStore.aiProviders.find(p => p.id === configStore.activeAIProviderId)
    if (!provider) {
      ElMessage.warning('请先在系统设置中配置 AI 模型')
      runningTests.value.delete(test.id)
      return
    }

    await window.electronAPI.visualTest.init(JSON.stringify(provider))

    const result = await window.electronAPI.visualTest.run({
      id: test.id,
      serial,
      packageName: targetPackage.value,
      testType: test.id
    })

    currentResult.value = result
  } catch (error: any) {
    addLog(`测试异常: ${error.message}`)
    currentResult.value = {
      testId: test.id,
      passed: false,
      duration: 0,
      steps: [],
      screenshots: []
    }
  } finally {
    runningTests.value.delete(test.id)
  }
}

const testLogs = ref<string[]>([])

function addLog(msg: string) {
  testLogs.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
}

const emit = defineEmits(['select-mode', 'open-settings'])
</script>

<style scoped>
.auto-test-mode {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.test-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  border-radius: 16px;
}

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.provider-tag {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.provider-tag.warn {
  color: var(--warning);
  border-color: var(--warning);
}

.device-selector {
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.test-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.test-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-radius: 12px;
}

.test-info h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
}

.test-info p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.test-result {
  padding: 20px;
  border-radius: 12px;
}

.result-status {
  font-size: 24px;
  font-weight: bold;
  margin: 12px 0;
}

.result-status.success {
  color: var(--success);
}

.result-status.failed {
  color: var(--danger);
}

.test-logs {
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.test-logs h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
}

.log-lines {
  max-height: 200px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 12px;
}

.log-line {
  padding: 4px 0;
  color: var(--text-secondary);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.glass {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
}
</style>
