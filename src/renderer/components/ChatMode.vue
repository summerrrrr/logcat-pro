<template>
  <div class="chat-mode">
    <div class="chat-container glass">
      <div class="chat-messages" ref="messageListRef">
        <div v-if="history.length === 0" class="empty-state">
          <el-icon :size="64" class="empty-icon"><MagicStick /></el-icon>
          <h3>我是你的 Android 系统诊断专家</h3>
          <p>你可以问我：</p>
          <div class="suggest-chips">
            <span @click="useQuery('分析最近的错误日志')">"分析最近的错误日志"</span>
            <span @click="useQuery('解释这个 ANR 的原因')">"解释这个 ANR 的原因"</span>
            <span @click="useQuery('如何优化这个内存泄漏？')">"如何优化这个内存泄漏？"</span>
          </div>
        </div>
        
        <div v-for="(msg, idx) in history" :key="idx" :class="['message-wrapper', msg.role]">
          <div class="avatar">
            <el-icon v-if="msg.role === 'assistant'"><Avatar /></el-icon>
            <el-icon v-else><User /></el-icon>
          </div>
          <div class="message-content glass" v-html="renderMarkdown(msg.content)"></div>
        </div>

        <div v-if="isAnalyzing" class="message-wrapper assistant">
          <div class="avatar spinning">
            <el-icon><Loading /></el-icon>
          </div>
          <div class="message-content glass typing">
            正在深度分析日志，请稍候...
          </div>
        </div>
      </div>

      <div class="chat-input-area glass">
        <div class="input-tools">
          <div class="tools-right">
            <el-button size="small" link @click="clearHistory">清除聊天记录</el-button>
          </div>
        </div>
        <div class="input-box">
          <el-input
            v-model="userInput"
            type="textarea"
            :rows="3"
            placeholder="描述你遇到的问题或点击上方快速分析..."
            @keydown.enter.prevent="handleSend"
            resize="none"
            class="chat-textarea"
          />
          <el-button 
            type="primary" 
            class="send-btn" 
            :loading="isAnalyzing"
            @click="handleSend"
          >
            <el-icon><Promotion /></el-icon>
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { ChatDotRound, MagicStick, Avatar, User, Loading, Promotion } from '@element-plus/icons-vue'
import { useAnalysisStore } from '../stores/analysisStore'
import { useLogStore } from '../stores/logStore'
import { useDeviceStore } from '../stores/deviceStore'
import { marked } from 'marked'

const analysisStore = useAnalysisStore()
const logStore = useLogStore()
const deviceStore = useDeviceStore()

const userInput = ref('')
const messageListRef = ref<HTMLElement | null>(null)

const history = computed(() => analysisStore.chatHistory || [])
const isAnalyzing = computed(() => analysisStore.isAnalyzing)

function renderMarkdown(text: string) {
  try {
    if (typeof marked.parse === 'function') {
      return marked.parse(text)
    }
    return (marked as any)(text)
  } catch (e) {
    return text
  }
}

function useQuery(query: string) {
  userInput.value = query
  handleSend()
}

function clearHistory() {
  analysisStore.chatHistory = []
}

async function handleSend() {
  if (!userInput.value.trim() || isAnalyzing.value) return

  const query = userInput.value
  analysisStore.addChatMessage('user', query)
  userInput.value = ''

  let context = `User Question: ${query}\n`
  if (deviceStore.activeDevice) {
    context += `Device: ${deviceStore.activeDevice}\n`
  }
  
  try {
    await analysisStore.analyzeWithAI([], context)
  } catch (e) {
    console.error('AI analysis error in component:', e)
  }
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

watch(() => history.value.length, scrollToBottom)

onMounted(scrollToBottom)
</script>

<style scoped>
.chat-mode {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: var(--bg-primary);
  overflow: hidden;
  box-sizing: border-box;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  opacity: 0.8;
  min-height: 300px;
}

.empty-icon {
  margin-bottom: 20px;
  color: var(--success);
}

.suggest-chips {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.suggest-chips span {
  padding: 8px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.suggest-chips span:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.message-wrapper {
  display: flex;
  gap: 12px;
  max-width: 85%;
}

.message-wrapper.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.spinning {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.message-content {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  word-break: break-word;
}

:deep(.message-content pre) {
  white-space: pre-wrap;
  word-wrap: break-word;
  background: rgba(0, 0, 0, 0.2);
  padding: 12px;
  border-radius: 8px;
  margin: 8px 0;
  overflow-x: hidden;
}

:deep(.message-content code) {
  white-space: pre-wrap;
  word-break: break-all;
}

.user .message-content {
  background: var(--accent);
  color: var(--bg-primary);
  font-weight: 500;
}

.chat-input-area {
  padding: 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.input-tools {
  margin-bottom: 8px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.input-box {
  display: flex;
  gap: 12px;
  align-items: stretch;
  height: 82px; /* 强制容器高度 */
}

:deep(.chat-textarea) {
  flex: 1;
}

:deep(.chat-textarea .el-textarea__inner) {
  height: 100% !important;
  resize: none !important;
  background: var(--bg-surface) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-primary) !important;
  padding: 12px;
  border-radius: 8px;
  box-shadow: none !important;
  transition: all 0.2s ease;
}

:deep(.chat-textarea .el-textarea__inner:hover) {
  border-color: var(--text-muted) !important;
}

:deep(.chat-textarea .el-textarea__inner:focus) {
  border-color: var(--accent) !important;
  background: var(--bg-secondary) !important;
  box-shadow: 0 0 0 2px var(--accent-soft) !important;
}

.send-btn {
  width: 60px;
  height: 100% !important;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.send-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(122, 162, 247, 0.3);
}

.glass {
  background: rgba(255, 255, 255, 0.01);
  backdrop-filter: blur(10px);
}

:deep(.message-content h3) {
  margin: 0 0 8px 0;
  font-size: 16px;
}

:deep(.message-content p) {
  margin: 0 0 8px 0;
}

:deep(.message-content ul) {
  margin: 0;
  padding-left: 20px;
}
</style>
