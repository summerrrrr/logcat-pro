<template>
  <div class="chart-view">
    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-title">Log Level Distribution</div>
        <v-chart :option="levelPieOption" autoresize class="chart" />
      </div>
      <div class="chart-card">
        <div class="chart-title">Log Rate (per second)</div>
        <v-chart :option="rateLineOption" autoresize class="chart" />
      </div>
      <div class="chart-card wide">
        <div class="chart-title">Top Tags</div>
        <v-chart :option="tagBarOption" autoresize class="chart" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart, LineChart, BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useAnalysisStore } from '../stores/analysisStore'

use([PieChart, LineChart, BarChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer])

const analysisStore = useAnalysisStore()

const levelColors: Record<string, string> = {
  V: '#6c7086',
  D: '#89b4fa',
  I: '#a6e3a1',
  W: '#f9e2af',
  E: '#f38ba8',
  F: '#cba6f7'
}

const levelPieOption = computed(() => {
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      itemStyle: { borderRadius: 4, borderColor: '#1e1e2e', borderWidth: 2 },
      label: { color: '#cdd6f4', fontSize: 12 },
      data: Object.entries(analysisStore.stats.levelCounts).map(([name, value]) => ({
        name,
        value,
        itemStyle: { color: levelColors[name] || '#6c7086' }
      }))
    }]
  }
})

const rateLineOption = computed(() => {
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: analysisStore.stats.rateHistory.map(r => r.time),
      axisLabel: { color: '#6c7086', fontSize: 10 },
      axisLine: { lineStyle: { color: '#45475a' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6c7086', fontSize: 10 },
      splitLine: { lineStyle: { color: '#313244' } }
    },
    series: [{
      type: 'line',
      data: analysisStore.stats.rateHistory.map(r => r.count),
      smooth: true,
      lineStyle: { color: '#89b4fa', width: 2 },
      areaStyle: { color: 'rgba(137,180,250,0.15)' },
      itemStyle: { color: '#89b4fa' }
    }],
    grid: { left: 40, right: 16, top: 16, bottom: 30 }
  }
})

const tagBarOption = computed(() => {
  const sorted = analysisStore.stats.tagCounts.slice(0, 15)
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: sorted.map(t => t.tag),
      axisLabel: { color: '#6c7086', fontSize: 10, rotate: 30 },
      axisLine: { lineStyle: { color: '#45475a' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6c7086', fontSize: 10 },
      splitLine: { lineStyle: { color: '#313244' } }
    },
    series: [{
      type: 'bar',
      data: sorted.map(t => t.count),
      itemStyle: { color: '#89b4fa', borderRadius: [4, 4, 0, 0] }
    }],
    grid: { left: 40, right: 16, top: 16, bottom: 60 }
  }
})
</script>

<style scoped>
.chart-view {
  height: 100%;
  overflow-y: auto;
  padding: 12px;
  background: var(--bg-primary);
}
.chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.chart-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
}
.chart-card.wide {
  grid-column: 1 / -1;
}
.chart-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.chart {
  width: 100%;
  height: 240px;
}
</style>
