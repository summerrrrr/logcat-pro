import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { Issue, LogEntry, LogLevel } from '../../shared/types'

export const useAnalysisStore = defineStore('analysis', () => {
  const issues = ref<Issue[]>([])
  const chatHistory = ref<{ role: 'user' | 'assistant'; content: string; timestamp: Date }[]>([])
  const isAnalyzing = ref(false)
  
  const stats = reactive({
    levelCounts: {} as Record<LogLevel, number>,
    tagCounts: [] as { tag: string; count: number }[],
    rateHistory: [] as { time: string; count: number }[],
  })

  function addChatMessage(role: 'user' | 'assistant', content: string) {
    chatHistory.value.push({ role, content, timestamp: new Date() })
  }

  async function analyzeWithAI(logs: LogEntry[], context?: string) {
    isAnalyzing.value = true
    try {
      // 必须将 Vue 响应式对象（Proxy）转换为纯 JS 对象，否则 Electron IPC 会报 "could not be cloned"
      // 提取需要的字段，过滤掉 Date 这种在 IPC 序列化中可能出问题的对象
      const cleanHistory = chatHistory.value.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
      
      const cleanLogs = JSON.parse(JSON.stringify(logs))

      const request = { 
        logs: cleanLogs, 
        context, 
        history: cleanHistory 
      }
      
      const result = await window.electronAPI.analysis.analyzeAI(request)
      
      // 直接使用纯文本响应
      const aiResponse = result.rawText || result.rootCause || 'No response'
      addChatMessage('assistant', aiResponse)
      return result
    } catch (e: any) {
      console.error('AI Analysis failed:', e)
      const errorMsg = e.message || String(e);
      addChatMessage('assistant', `**诊断失败** 🚨\n\n\`\`\`text\n${errorMsg}\n\`\`\`\n\n请检查右上角设置中的 API Key 和 URL 是否正确。如果是国内网络，请确保配置了可用的代理 URL。`)
      throw e
    } finally {
      isAnalyzing.value = false
    }
  }

  function initListener() {
    if (window.electronAPI && window.electronAPI.analysis) {
      window.electronAPI.analysis.onIssue((issue: Issue) => {
        issues.value.push(issue)
      })
    }
  }

  async function runAnalysis(serial?: string) {
    if (window.electronAPI && window.electronAPI.analysis) {
      const result = await window.electronAPI.analysis.run(serial)
      issues.value.push(...result)
      return result
    }
    return []
  }

  function updateStats(logs: LogEntry[]) {
    const levels: Record<string, number> = {}
    const tags: Record<string, number> = {}

    for (const log of logs) {
      levels[log.level] = (levels[log.level] || 0) + 1
      tags[log.tag] = (tags[log.tag] || 0) + 1
    }

    stats.levelCounts = levels as Record<LogLevel, number>
    stats.tagCounts = Object.entries(tags)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    const now = new Date()
    stats.rateHistory.push({
      time: now.toLocaleTimeString(),
      count: logs.length,
    })
    if (stats.rateHistory.length > 60) {
      stats.rateHistory.shift()
    }
  }

  return {
    issues,
    chatHistory,
    isAnalyzing,
    stats,
    addChatMessage,
    analyzeWithAI,
    initListener,
    runAnalysis,
    updateStats,
  }
})
