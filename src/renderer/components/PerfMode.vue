<template>
  <div class="perf-mode">
    <div class="perf-header glass">
      <div class="header-left">
        <el-icon :size="20"><PieChart /></el-icon>
        <span class="title">性能监控中心</span>
        <el-tag v-if="activePid" :type="isPaused ? 'warning' : 'success'" size="small" class="status-tag">
          {{ isPaused ? '已暂停' : '监控中' }}
        </el-tag>
      </div>
      
      <div class="header-right">
        <!-- 控制按钮组 -->
        <el-button-group class="control-group">
          <el-button 
            :type="isPolling ? 'danger' : 'primary'" 
            @click="togglePolling"
            :disabled="!selectedPid"
            class="action-btn"
          >
            <el-icon><component :is="isPolling ? Close : VideoPlay" /></el-icon>
            <span>{{ isPolling ? '停止监控' : '开始监控' }}</span>
          </el-button>
          
          <el-button 
            @click="deviceStore.togglePause()"
            :disabled="!isPolling"
            class="action-btn"
          >
            <el-icon><component :is="isPaused ? VideoPlay : VideoPause" /></el-icon>
            <span>{{ isPaused ? '继续' : '暂停' }}</span>
          </el-button>
          
          <el-button 
            @click="deviceStore.clearPerformanceData()"
            class="action-btn"
          >
            <el-icon><Delete /></el-icon>
            <span>清空</span>
          </el-button>
        </el-button-group>

        <el-divider direction="vertical" />

        <el-select 
          v-model="selectedPid" 
          placeholder="选择监控进程" 
          filterable 
          @change="handlePidChange"
          class="process-select"
        >
          <el-option
            v-for="proc in processes"
            :key="proc.pid"
            :label="`${proc.name} (${proc.pid})`"
            :value="proc.pid"
          />
        </el-select>
        
        <el-button @click="refreshProcesses" :loading="loadingProcesses" circle>
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div v-if="!activePid && !isPolling" class="welcome-screen">
      <div class="welcome-card glass">
        <el-icon :size="48" class="welcome-icon"><Cpu /></el-icon>
        <h2>开始性能分析</h2>
        <p>1. 在右上角选择需要监控的进程<br>2. 点击播放按钮开始实时采集数据</p>
      </div>
    </div>

    <div v-else class="charts-container">
      <div class="chart-card glass">
        <div class="chart-header">
          <span class="chart-title">CPU 使用率 (%)</span>
          <span class="chart-value">{{ currentCpu.toFixed(1) }}%</span>
        </div>
        <div ref="cpuChartRef" class="chart-body"></div>
      </div>

      <div class="chart-card glass">
        <div class="chart-header">
          <span class="chart-title">内存占用 (PSS MB)</span>
          <span class="chart-value">{{ currentMem.toFixed(1) }} MB</span>
        </div>
        <div ref="memChartRef" class="chart-body"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { PieChart, Refresh, Cpu, VideoPlay, VideoPause, Delete, Close } from '@element-plus/icons-vue'
import { useDeviceStore } from '../stores/deviceStore'
import * as echarts from 'echarts'

const deviceStore = useDeviceStore()
const processes = ref<any[]>([])
const loadingProcesses = ref(false)
const selectedPid = ref<number | null>(deviceStore.activePid)

const cpuChartRef = ref<HTMLElement | null>(null)
const memChartRef = ref<HTMLElement | null>(null)
let cpuChart: echarts.ECharts | null = null
let memChart: echarts.ECharts | null = null

const activePid = computed(() => deviceStore.activePid)
const isPaused = computed(() => deviceStore.isPaused)
const isPolling = computed(() => !!deviceStore.activePid)

const currentCpu = computed(() => {
  const data = deviceStore.performanceData.cpu
  return data.length > 0 ? data[data.length - 1] : 0
})
const currentMem = computed(() => {
  const data = deviceStore.performanceData.memory
  return data.length > 0 ? data[data.length - 1] : 0
})

async function refreshProcesses() {
  if (!deviceStore.activeDevice) return
  loadingProcesses.value = true
  try {
    processes.value = await window.electronAPI.device.listProcesses(deviceStore.activeDevice)
  } catch (e) {
    console.error('Failed to list processes:', e)
  } finally {
    loadingProcesses.value = false
  }
}

function handlePidChange(pid: number) {
  // 仅选中，不自动开始，除非点击播放
}

function togglePolling() {
  if (isPolling.value) {
    deviceStore.setActivePid(null)
  } else if (selectedPid.value) {
    deviceStore.setActivePid(selectedPid.value)
  }
}

function initCharts() {
  if (cpuChartRef.value) {
    cpuChart = echarts.init(cpuChartRef.value)
    cpuChart.setOption(getChartOption('CPU 使用率', '#fb7185'))
  }
  if (memChartRef.value) {
    memChart = echarts.init(memChartRef.value)
    memChart.setOption(getChartOption('内存占用', '#38bdf8'))
  }
}

function getChartOption(name: string, color: string) {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: [], boundaryGap: false },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [{
      name,
      type: 'line',
      smooth: true,
      data: [],
      lineStyle: { color, width: 3 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: color + '80' },
          { offset: 1, color: color + '00' }
        ])
      },
      symbol: 'none'
    }]
  }
}

watch(() => deviceStore.performanceData, (newData) => {
  if (cpuChart && memChart) {
    cpuChart.setOption({
      xAxis: { data: newData.timestamps },
      series: [{ data: newData.cpu }]
    })
    memChart.setOption({
      xAxis: { data: newData.timestamps },
      series: [{ data: newData.memory }]
    })
  }
}, { deep: true })

watch(activePid, async (newPid) => {
  if (newPid) {
    await nextTick()
    initCharts()
  } else {
    cpuChart?.dispose()
    memChart?.dispose()
    cpuChart = null
    memChart = null
  }
})

onMounted(() => {
  refreshProcesses()
  if (activePid.value) {
    nextTick(initCharts)
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  cpuChart?.dispose()
  memChart?.dispose()
})

function handleResize() {
  cpuChart?.resize()
  memChart?.resize()
}
</script>

<style scoped>
.perf-mode {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
  padding: 16px;
  gap: 16px;
}

.perf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title {
  font-weight: 600;
  color: var(--text-primary);
}

.status-tag {
  margin-left: 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-group {
  margin-right: 8px;
}

.process-select {
  width: 220px;
}

.welcome-screen {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-card {
  padding: 48px;
  border-radius: 24px;
  text-align: center;
  max-width: 400px;
}

.welcome-icon {
  color: #fb7185;
  margin-bottom: 20px;
}

.welcome-card p {
  color: var(--text-secondary);
  line-height: 2;
  font-size: 14px;
}

.charts-container {
  flex: 1;
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: 16px;
  overflow: auto;
}

.chart-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.chart-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.chart-value {
  font-size: 18px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-primary);
}

.chart-body {
  flex: 1;
  min-height: 200px;
}

.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}
</style>
