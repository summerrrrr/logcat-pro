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
        <el-icon :size="48" class="welcome-icon"><PieChart /></el-icon>
        <h2>开始性能分析</h2>
        <p>1. 在右上角选择需要监控的进程<br>2. 点击播放按钮开始实时采集数据</p>
      </div>
    </div>

    <div v-else class="charts-container">
      <div class="chart-card glass cpu-chart">
        <div class="chart-header">
          <span class="chart-title">CPU 使用率 (%)</span>
          <span class="chart-value">{{ currentCpu.toFixed(1) }}%</span>
        </div>
        <div ref="cpuChartRef" class="chart-body"></div>
      </div>

      <div class="bottom-charts">
        <div class="chart-card glass">
          <div class="chart-header">
            <span class="chart-title">内存占用 (PSS MB)</span>
            <span class="chart-value">{{ currentMem.toFixed(1) }} MB</span>
          </div>
          <div ref="memChartRef" class="chart-body"></div>
        </div>

        <div class="chart-card glass">
          <div class="chart-header">
            <span class="chart-title">帧率 (FPS)</span>
            <span class="chart-value">{{ currentFps.toFixed(1) }} FPS</span>
          </div>
          <div ref="fpsChartRef" class="chart-body"></div>
        </div>
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
const fpsChartRef = ref<HTMLElement | null>(null)
let cpuChart: echarts.ECharts | null = null
let memChart: echarts.ECharts | null = null
let fpsChart: echarts.ECharts | null = null

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
const currentFps = computed(() => {
  const data = deviceStore.performanceData.fps
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
  if (fpsChartRef.value) {
    fpsChart = echarts.init(fpsChartRef.value)
    fpsChart.setOption(getChartOption('帧率', '#10b981'))
  }
}

function getChartOption(name: string, color: string) {
  return {
    animation: false,
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: true
      }
    ],
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
      symbol: 'none',
      large: true,
      largeThreshold: 200,
      sampling: 'lttb'
    }]
  }
}

// 优化：避免深度监听，减少 GC 压力
// 使用 watchEffect 并立即解构，避免闭包持有引用
let stopWatchEffect: (() => void) | null = null

function updateCharts() {
  if (!cpuChart || !memChart || !fpsChart) return

  // 立即解构，避免持有 store 引用
  const { timestamps, cpu, memory, fps } = deviceStore.performanceData

  cpuChart.setOption({
    xAxis: { data: timestamps },
    series: [{ data: cpu }]
  })
  memChart.setOption({
    xAxis: { data: timestamps },
    series: [{ data: memory }]
  })
  fpsChart.setOption({
    xAxis: { data: timestamps },
    series: [{ data: fps }]
  })
}

// 使用 watch 而不是 watchEffect，更精确控制
stopWatchEffect = watch(
  () => deviceStore.performanceData.timestamps.length,
  () => updateCharts(),
  { flush: 'post' }
)

watch(activePid, async (newPid) => {
  if (newPid) {
    await nextTick()
    initCharts()
  } else {
    // 确保清理图表实例
    if (cpuChart) {
      cpuChart.dispose()
      cpuChart = null
    }
    if (memChart) {
      memChart.dispose()
      memChart = null
    }
    if (fpsChart) {
      fpsChart.dispose()
      fpsChart = null
    }
  }
})

onMounted(() => {
  refreshProcesses()
  if (activePid.value) {
    nextTick(initCharts)
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(async () => {
  console.log('[PerfMode] 🔴 组件开始卸载...')

  // 打印卸载前的内存信息（如果可用）
  if (performance.memory) {
    console.log('[PerfMode] 卸载前内存:', {
      usedJSHeapSize: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      totalJSHeapSize: `${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      jsHeapSizeLimit: `${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
    })
  }

  // 停止 watch 监听器
  if (stopWatchEffect) {
    console.log('[PerfMode] 停止 watch 监听器...')
    stopWatchEffect()
    stopWatchEffect = null
  }

  // 🔥 关键修复：必须在 setActivePid(null) 之前保存当前的设备和进程信息
  // 因为 setActivePid(null) 会将 activePid 清空，导致后续无法清理主进程缓存
  const currentDevice = deviceStore.activeDevice
  const currentPid = deviceStore.activePid

  // 停止性能监控
  if (isPolling.value) {
    console.log('[PerfMode] 停止性能轮询...')
    deviceStore.stopPerformancePolling()
  }

  // 🔥 关键修复：清理主进程 AdbManager 中的缓存
  if (currentDevice && currentPid) {
    console.log(`[PerfMode] 清理主进程缓存: device=${currentDevice}, pid=${currentPid}`)
    try {
      await window.electronAPI.device.clearProcessStats(currentDevice, currentPid)
      console.log('[PerfMode] ✅ 主进程缓存已清理')
    } catch (e) {
      console.warn('[PerfMode] ⚠️ 清理主进程缓存失败:', e)
    }
  } else {
    console.log(`[PerfMode] 无需清理主进程缓存 (device=${currentDevice}, pid=${currentPid})`)
  }

  // 🔥 关键修复：清空 activePid，避免重新打开页面时显示"监控中"
  console.log('[PerfMode] 清空 activePid 状态...')
  deviceStore.activePid = null

  // 清空性能历史数据，释放内存
  console.log('[PerfMode] 清空性能历史数据...')
  deviceStore.clearPerformanceData()

  // 移除事件监听器
  console.log('[PerfMode] 移除事件监听器...')
  window.removeEventListener('resize', handleResize)

  // 确保销毁所有图表实例，防止内存泄漏
  console.log('[PerfMode] 销毁图表实例...')
  if (cpuChart) {
    cpuChart.dispose()
    cpuChart = null
    console.log('[PerfMode] ✅ CPU图表已销毁')
  }
  if (memChart) {
    memChart.dispose()
    memChart = null
    console.log('[PerfMode] ✅ 内存图表已销毁')
  }
  if (fpsChart) {
    fpsChart.dispose()
    fpsChart = null
    console.log('[PerfMode] ✅ FPS图表已销毁')
  }

  // 清空进程列表，释放引用
  processes.value = []
  selectedPid.value = null

  console.log('[PerfMode] 🟢 组件卸载完成')
  console.log('[PerfMode] 💡 提示：在 Chrome DevTools 中手动触发 GC，观察内存释放效果')
  console.log('[PerfMode] 💡 主进程内存：打开任务管理器查看 Electron 主进程内存变化')

  // 延迟打印卸载后的内存信息
  setTimeout(() => {
    if (performance.memory) {
      console.log('[PerfMode] 卸载后内存（GC前）:', {
        usedJSHeapSize: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        totalJSHeapSize: `${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`
      })
    }
  }, 100)
})

function handleResize() {
  cpuChart?.resize()
  memChart?.resize()
  fpsChart?.resize()
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
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.cpu-chart {
  flex: 1;
  min-height: 0;
}

.bottom-charts {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  min-height: 0;
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
