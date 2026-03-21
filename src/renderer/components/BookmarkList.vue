<template>
  <div class="bookmark-list">
    <div class="panel-header">
      <span>书签 ({{ bookmarks.length }})</span>
    </div>
    <div class="bookmark-items">
      <div
        v-for="bm in bookmarks"
        :key="bm.id"
        class="bookmark-item"
      >
        <span class="color-dot" :style="{ background: bm.color }" />
        <div class="bookmark-info">
          <div class="bookmark-note">{{ bm.note || '无备注' }}</div>
          <div class="bookmark-meta">Log #{{ bm.logId }}</div>
        </div>
        <el-button
          size="small"
          text
          class="delete-btn"
          @click="onRemove(bm.id)"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
      <div v-if="!bookmarks.length" class="empty-state">
        暂无书签
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Close } from '@element-plus/icons-vue'
import type { Bookmark } from '../../shared/types'

const bookmarks = ref<Bookmark[]>([])

onMounted(async () => {
  bookmarks.value = await window.electronAPI.bookmark.list()
})

async function onRemove(id: number) {
  await window.electronAPI.bookmark.remove(id)
  bookmarks.value = bookmarks.value.filter(b => b.id !== id)
}

async function refresh() {
  bookmarks.value = await window.electronAPI.bookmark.list()
}

defineExpose({ refresh })
</script>

<style scoped>
.bookmark-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.panel-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}
.bookmark-items {
  flex: 1;
  overflow-y: auto;
}
.bookmark-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  transition: background 0.15s;
}
.bookmark-item:hover {
  background: var(--bg-hover);
}
.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.bookmark-info {
  flex: 1;
  min-width: 0;
}
.bookmark-note {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bookmark-meta {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
.delete-btn {
  opacity: 0;
  transition: opacity 0.15s;
}
.bookmark-item:hover .delete-btn {
  opacity: 1;
}
.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
