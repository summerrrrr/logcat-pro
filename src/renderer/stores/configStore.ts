import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { AIProviderConfig } from '../../shared/types'

export interface HighlightRule {
  id: string
  pattern: string
  color: string
  isRegex: boolean
  enabled: boolean
}

export const useConfigStore = defineStore('config', () => {
  // --- LLM Providers ---
  const savedProviders = localStorage.getItem('aiProviders')
  const aiProviders = ref<AIProviderConfig[]>(savedProviders ? JSON.parse(savedProviders) : [])
  const activeAIProviderId = ref(localStorage.getItem('activeAIProviderId') || '')

  watch(aiProviders, (newVal) => {
    localStorage.setItem('aiProviders', JSON.stringify(newVal))
  }, { deep: true })

  watch(activeAIProviderId, (newVal) => {
    localStorage.setItem('activeAIProviderId', newVal)
  })

  function addAIProvider(provider: Omit<AIProviderConfig, 'id'>) {
    const id = Date.now().toString()
    aiProviders.value.push({ ...provider, id })
    if (!activeAIProviderId.value) activeAIProviderId.value = id
    return id
  }

  function removeAIProvider(id: string) {
    aiProviders.value = aiProviders.value.filter(p => p.id !== id)
    if (activeAIProviderId.value === id) {
      activeAIProviderId.value = aiProviders.value[0]?.id || ''
    }
  }

  function updateAIProvider(id: string, updates: Partial<AIProviderConfig>) {
    const p = aiProviders.value.find(p => p.id === id)
    if (p) Object.assign(p, updates)
  }

  // --- Gemini API Config (Legacy) ---
  const geminiApiKey = ref(localStorage.getItem('geminiApiKey') || '')
  const geminiApiUrl = ref(localStorage.getItem('geminiApiUrl') || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent')

  function syncGeminiConfig() {
    localStorage.setItem('geminiApiKey', geminiApiKey.value)
    localStorage.setItem('geminiApiUrl', geminiApiUrl.value)
    if (window.electronAPI && window.electronAPI.config) {
      if (window.electronAPI.config.setGeminiConfig) {
        window.electronAPI.config.setGeminiConfig({ key: geminiApiKey.value, url: geminiApiUrl.value })
      }
    }
  }

  // 初始化时同步一次到主进程
  syncGeminiConfig()

  watch(geminiApiKey, (newVal) => {
    localStorage.setItem('geminiApiKey', newVal)
    syncGeminiConfig()
  })

  watch(geminiApiUrl, (newVal) => {
    localStorage.setItem('geminiApiUrl', newVal)
    syncGeminiConfig()
  })

  // --- File Save Path ---
  const fileSavePath = ref(localStorage.getItem('fileSavePath') || '')

  watch(fileSavePath, (newVal) => {
    localStorage.setItem('fileSavePath', newVal)
  })

  // --- Highlight Rules ---
  const defaultRules: HighlightRule[] = [
    { id: '1', pattern: 'fatal', color: '#f38ba8', isRegex: false, enabled: true },
    { id: '2', pattern: 'exception', color: '#f38ba8', isRegex: false, enabled: true },
    { id: '3', pattern: 'anr in', color: '#f38ba8', isRegex: false, enabled: true },
    { id: '4', pattern: 'warning', color: '#f9e2af', isRegex: false, enabled: true }
  ]

  const savedRules = localStorage.getItem('highlightRules')
  const highlightRules = ref<HighlightRule[]>(savedRules ? JSON.parse(savedRules) : defaultRules)

  watch(highlightRules, (newVal) => {
    localStorage.setItem('highlightRules', JSON.stringify(newVal))
  }, { deep: true })

  function addRule(rule: Omit<HighlightRule, 'id'>) {
    highlightRules.value.push({
      ...rule,
      id: Date.now().toString()
    })
  }

  function removeRule(id: string) {
    highlightRules.value = highlightRules.value.filter(r => r.id !== id)
  }

  function updateRule(id: string, updates: Partial<HighlightRule>) {
    const rule = highlightRules.value.find(r => r.id === id)
    if (rule) {
      Object.assign(rule, updates)
    }
  }

  // --- UI Preferences ---
  const skipExitConfirmation = ref(localStorage.getItem('skipExitConfirmation') === 'true')
  const skipHomeCloseConfirmation = ref(localStorage.getItem('skipHomeCloseConfirmation') === 'true')
  const closeAction = ref<'exit' | 'minimize'>(localStorage.getItem('closeAction') as 'exit' | 'minimize' || 'exit')

  watch(skipExitConfirmation, (newVal) => {
    localStorage.setItem('skipExitConfirmation', String(newVal))
  })

  watch(skipHomeCloseConfirmation, (newVal) => {
    localStorage.setItem('skipHomeCloseConfirmation', String(newVal))
  })

  watch(closeAction, (newVal) => {
    localStorage.setItem('closeAction', newVal)
  })

  return {
    geminiApiKey,
    geminiApiUrl,
    aiProviders,
    activeAIProviderId,
    addAIProvider,
    removeAIProvider,
    updateAIProvider,
    fileSavePath,
    highlightRules,
    skipExitConfirmation,
    skipHomeCloseConfirmation,
    closeAction,
    addRule,
    removeRule,
    updateRule
  }
})
