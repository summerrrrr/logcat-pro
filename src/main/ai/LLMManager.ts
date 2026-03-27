import { AIAnalysisRequest, AIAnalysisResult, LogEntry, AIProviderConfig, AIChatMessage, AIProviderType } from '../../shared/types'

export interface ModelInfo {
  id: string
  name: string
}

export class LLMManager {
  private systemPrompt = 'You are an expert Android System Engineer. Provide direct, helpful, and concise answers using Markdown. Analyze logs, diagnose issues, and give actionable suggestions.'

  private static fallbackModels: Record<string, ModelInfo[]> = {
    gemini: [
      { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    ],
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'o3-mini', name: 'o3 Mini' },
    ],
    claude: [
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5' },
    ],
    codex: [
      { id: 'codex-mini-latest', name: 'Codex Mini' },
    ],
    custom: []
  }

  // --- 获取模型列表 ---
  async fetchModels(type: AIProviderType, apiKey: string, apiUrl: string): Promise<ModelInfo[]> {
    if (!apiKey) throw new Error('请先填写 API Key')

    const baseUrl = this.extractBaseUrl(type, apiUrl)

    try {
      switch (type) {
        case 'gemini':
          return await this.fetchGeminiModels(apiKey, baseUrl)
        case 'openai':
        case 'custom':
        case 'codex':
          return await this.fetchOpenAIModels(apiKey, baseUrl)
        case 'claude':
          return await this.fetchClaudeModels(apiKey, baseUrl)
        default:
          return LLMManager.fallbackModels[type] || []
      }
    } catch (e: any) {
      console.warn(`[LLMManager] 从 API 获取模型列表失败，使用预置列表: ${e.message}`)
      const fallback = LLMManager.fallbackModels[type] || []
      if (fallback.length > 0) {
        return fallback
      }
      throw e
    }
  }

  private extractBaseUrl(type: AIProviderType, apiUrl: string): string {
    if (!apiUrl) {
      const defaults: Record<string, string> = {
        gemini: 'https://generativelanguage.googleapis.com',
        openai: 'https://api.openai.com',
        claude: 'https://api.anthropic.com',
        codex: 'https://api.openai.com',
        custom: ''
      }
      return defaults[type] || ''
    }
    // 去掉已知的 API 路径后缀，保留代理前缀
    let url = apiUrl.replace(/\/+$/, '')
    url = url
      .replace(/\/v1beta\/models\/[^/]+:generateContent.*$/, '')  // Gemini
      .replace(/\/v1beta\/models.*$/, '')                          // Gemini models
      .replace(/\/v1\/chat\/completions.*$/, '')                   // OpenAI
      .replace(/\/v1\/responses.*$/, '')                           // Codex
      .replace(/\/v1\/messages.*$/, '')                             // Claude
      .replace(/\/v1\/models.*$/, '')                               // models endpoint
    return url
  }

  private async fetchGeminiModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
    const url = `${baseUrl}/v1beta/models?key=${apiKey}`
    const res = await fetch(url, {
      headers: { 'x-goog-api-key': apiKey }
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Gemini 获取模型失败 (${res.status}): ${url.split('?')[0]} - ${errBody.slice(0, 200)}`)
    }
    const data = await res.json()
    return (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => ({
        id: m.name?.replace('models/', '') || m.name,
        name: m.displayName || m.name
      }))
  }

  private async fetchOpenAIModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
    const url = `${baseUrl}/v1/models`
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`OpenAI 获取模型失败 (${res.status}): ${url} - ${errBody.slice(0, 200)}`)
    }
    const data = await res.json()
    return (data.data || [])
      .map((m: any) => ({ id: m.id, name: m.id }))
      .sort((a: ModelInfo, b: ModelInfo) => a.id.localeCompare(b.id))
  }

  private async fetchClaudeModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
    const url = `${baseUrl}/v1/models`
    const res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Claude 获取模型失败 (${res.status}): ${url} - ${errBody.slice(0, 200)}`)
    }
    const data = await res.json()
    return (data.data || [])
      .map((m: any) => ({
        id: m.id,
        name: m.display_name || m.id
      }))
  }

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    const { providerConfig, logs, context, history } = request

    if (!providerConfig.apiKey) {
      throw new Error(`Provider ${providerConfig.name} 未配置 API Key`)
    }

    const prompt = this.buildPrompt(logs, context)

    switch (providerConfig.type) {
      case 'gemini':
        return this.callGemini(providerConfig, prompt, history)
      case 'openai':
      case 'custom':
        return this.callOpenAI(providerConfig, prompt, history)
      case 'claude':
        return this.callClaude(providerConfig, prompt, history)
      case 'codex':
        return this.callCodex(providerConfig, prompt, history)
      default:
        throw new Error(`不支持的 Provider 类型: ${providerConfig.type}`)
    }
  }

  private buildPrompt(logs: LogEntry[], context?: string): string {
    let prompt = ''
    if (context) {
      prompt += `${context}\n\n`
    }
    if (logs.length > 0) {
      const logsText = logs.map(l => `${l.timestamp} ${l.level}/${l.tag}(${l.pid}): ${l.message}`).join('\n')
      prompt += `Reference Logs:\n\`\`\`\n${logsText}\n\`\`\`\n`
    }
    return prompt.trim() || 'Hello, I need some Android development help.'
  }

  // --- Gemini ---
  private async callGemini(config: AIProviderConfig, prompt: string, history?: AIChatMessage[]): Promise<AIAnalysisResult> {
    const contents: any[] = []
    if (history) {
      for (const msg of history) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })
      }
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] })

    let finalUrl = config.apiUrl
    if (!finalUrl.includes('/v1beta') && !finalUrl.includes('/v1')) {
      // 纯域名，拼完整路径
      finalUrl = finalUrl.replace(/\/+$/, '') + `/v1beta/models/${config.model}:generateContent`
    } else {
      // URL 已包含路径，替换其中的模型名为实际选择的模型
      finalUrl = finalUrl.replace(/\/models\/[^/:]+/, `/models/${config.model}`)
    }

    const fetchUrl = finalUrl.includes('?')
      ? `${finalUrl}&key=${config.apiKey}`
      : `${finalUrl}?key=${config.apiKey}`

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey
      },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: this.systemPrompt }]
        }
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Gemini API 错误 (${response.status}): ${errText}`)
    }
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return this.wrapResult(text)
  }

  // --- OpenAI / Custom ---
  private async callOpenAI(config: AIProviderConfig, prompt: string, history?: AIChatMessage[]): Promise<AIAnalysisResult> {
    const messages: any[] = [
      { role: 'system', content: this.systemPrompt }
    ]
    if (history) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
    messages.push({ role: 'user', content: prompt })

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: 4096
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenAI API 错误 (${response.status}): ${errText}`)
    }
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    return this.wrapResult(text)
  }

  // --- Claude ---
  private async callClaude(config: AIProviderConfig, prompt: string, history?: AIChatMessage[]): Promise<AIAnalysisResult> {
    const messages: any[] = []
    if (history) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
    messages.push({ role: 'user', content: prompt })

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system: this.systemPrompt,
        messages
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Claude API 错误 (${response.status}): ${errText}`)
    }
    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    return this.wrapResult(text)
  }

  // --- Codex (OpenAI Responses API) ---
  private async callCodex(config: AIProviderConfig, prompt: string, history?: AIChatMessage[]): Promise<AIAnalysisResult> {
    // Codex uses the OpenAI Responses API format
    const input: any[] = [
      { role: 'system', content: this.systemPrompt }
    ]
    if (history) {
      for (const msg of history) {
        input.push({ role: msg.role, content: msg.content })
      }
    }
    input.push({ role: 'user', content: prompt })

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        input
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Codex API 错误 (${response.status}): ${errText}`)
    }
    const data = await response.json()
    // Responses API returns output_text at top level
    const text = data.output_text || data.choices?.[0]?.message?.content || ''
    return this.wrapResult(text)
  }

  private wrapResult(text: string): AIAnalysisResult {
    return {
      summary: '',
      rootCause: '',
      suggestions: [],
      confidence: 1.0,
      rawText: text
    }
  }
}
