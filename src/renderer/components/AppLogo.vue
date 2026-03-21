<template>
  <div class="app-logo" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :viewBox="'0 0 200 200'" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- 背景六边形 -->
      <path d="M100 10L177.942 55V145L100 190L22.0577 145V55L100 10Z" fill="#161922" stroke="#7aa2f7" stroke-width="8" stroke-join="round"/>
      
      <defs>
        <linearGradient id="logo_gradient" x1="100" y1="50" x2="100" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#7aa2f7"/>
          <stop offset="100%" stop-color="#bb9af7"/>
        </linearGradient>
      </defs>

      <!-- 抽象猫头/代码括号 -->
      <path d="M60 70L80 45L100 60L120 45L140 70V110H60V70Z" fill="url(#logo_gradient)" opacity="0.9"/>
      
      <!-- 日志线条 (胡须) -->
      <rect x="70" y="125" width="60" height="4" rx="2" fill="#7aa2f7"/>
      <rect x="75" y="135" width="50" height="4" rx="2" fill="#7aa2f7" opacity="0.7"/>
      <rect x="85" y="145" width="30" height="4" rx="2" fill="#7aa2f7" opacity="0.4"/>

      <!-- 性能脉冲线 -->
      <path class="pulse-line" d="M65 95H85L92 80L108 110L115 95H135" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  size?: number | string
}>()
</script>

<style scoped>
.app-logo {
  display: inline-block;
  vertical-align: middle;
}

.pulse-line {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: pulse 3s ease-in-out infinite;
}

@keyframes pulse {
  0% { stroke-dashoffset: 100; opacity: 0.5; }
  50% { stroke-dashoffset: 0; opacity: 1; }
  100% { stroke-dashoffset: -100; opacity: 0.5; }
}
</style>