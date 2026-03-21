<template>
  <div class="home-mode">
    <div class="logo-container">
      <el-icon class="logo-icon"><Monitor /></el-icon>
      <h1>LogCat Pro</h1>
      <p class="subtitle">智能驱动的 Android 全栈开发调试与性能分析平台</p>
    </div>
    
    <div class="module-cards">
      <!-- Live Log Card -->
      <div class="module-card card-live" @click="$emit('select-mode', 'live')">
        <div class="card-icon">
          <el-icon><Iphone /></el-icon>
        </div>
        <div class="card-content">
          <h3>实时设备日志</h3>
          <p>连接 Android 设备，实时采集、过滤、分析系统与应用日志，支持 AI 辅助诊断。</p>
        </div>
        <el-icon class="arrow-icon"><ArrowRight /></el-icon>
      </div>

      <!-- File Analyzer Card -->
      <div class="module-card card-file" @click="$emit('select-mode', 'file')">
        <div class="card-icon">
          <el-icon><Document /></el-icon>
        </div>
        <div class="card-content">
          <h3>本地文件分析</h3>
          <p>打开本地离线日志或系统导出的文本文件，支持多标签页比对、设备目录漫游。</p>
        </div>
        <el-icon class="arrow-icon"><ArrowRight /></el-icon>
      </div>

      <!-- Performance Monitor Card -->
      <div class="module-card card-perf" @click="$emit('select-mode', 'perf')">
        <div class="card-icon">
          <el-icon><PieChart /></el-icon>
        </div>
        <div class="card-content">
          <h3>性能监控</h3>
          <p>实时监控指定进程的 CPU、内存占用以及帧率波动，可视化展示性能趋势。</p>
        </div>
        <el-icon class="arrow-icon"><ArrowRight /></el-icon>
      </div>

      <!-- AI Q&A Card -->
      <div class="module-card card-chat" @click="$emit('select-mode', 'chat')">
        <div class="card-icon">
          <el-icon><ChatDotRound /></el-icon>
        </div>
        <div class="card-content">
          <h3>智能问答</h3>
          <p>基于大模型的 Android 开发知识库，解答系统架构、调试技巧与代码优化建议。</p>
        </div>
        <el-icon class="arrow-icon"><ArrowRight /></el-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Monitor, Iphone, ArrowRight, PieChart, ChatDotRound, Document } from '@element-plus/icons-vue'

defineEmits(['select-mode', 'open-settings'])
</script>

<style scoped>
.home-mode {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.logo-container {
  text-align: center;
  margin-bottom: 100px;
  margin-top: -120px;
}

.logo-icon {
  font-size: 48px;
  color: var(--accent);
  margin-bottom: 12px;
}

.logo-container h1 {
  font-size: 36px;
  color: #ffffff;
  margin: 0 0 12px 0;
  font-weight: 800;
  letter-spacing: 3px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.module-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  max-width: 860px;
  width: 100%;
}

.module-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.module-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  transition: all 0.3s ease;
}

.card-content { flex: 1; }

.card-content h3 {
  font-size: 18px;
  margin: 0 0 6px 0;
  font-weight: 700;
  transition: all 0.3s ease;
}

.card-content p {
  font-size: 13px;
  line-height: 1.5;
  color: #94a3b8;
  margin: 0;
  padding-right: 24px;
}

/* Individual Module Themes */
.card-live .card-icon { color: #38bdf8; }
.card-live h3 { color: #38bdf8; }
.card-live .arrow-icon { color: #38bdf8; }

.card-file .card-icon { color: #fbbf24; }
.card-file h3 { color: #fbbf24; }
.card-file .arrow-icon { color: #fbbf24; }

.card-perf .card-icon { color: #fb7185; }
.card-perf h3 { color: #fb7185; }
.card-perf .arrow-icon { color: #fb7185; }

.card-chat .card-icon { color: #34d399; }
.card-chat h3 { color: #34d399; }
.card-chat .arrow-icon { color: #34d399; }

.module-card:hover .card-icon { transform: scale(1.1); background: rgba(255, 255, 255, 0.1); }
.module-card:hover h3 { filter: brightness(1.2); }

.arrow-icon {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%) translateX(-10px);
  font-size: 18px;
  opacity: 0;
  transition: all 0.3s ease;
}

.module-card:hover .arrow-icon {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

@media (max-height: 700px) {
  .logo-container { margin-bottom: 60px; }
}
</style>