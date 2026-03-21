import { AIAnalysisRequest, AIAnalysisResult, LogEntry, AIProviderConfig } from '../../shared/types'

export class LLMManager {
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    const { providerConfig, logs, context, history } = request

    if (!providerConfig.apiKey) {
      throw new Error(`Provider ${providerConfig.name} has no API Key configured.`)
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
      default:
        throw new Error(`Unsupported provider type: ${providerConfig.type}`)
    }
  }

  private buildPrompt(logs: LogEntry[], context?: string): string {
    const logsText = logs.map(l => `${l.timestamp} ${l.level}/${l.tag}(${l.pid}): ${l.message}`).join('\n')
    return `
You are an expert Android System Engineer. Analyze the following log segment and identify the root cause of any errors.
Context: ${context || 'Continuous log monitoring'}

Logs:
\`\`\`
${logsText}
\`\`\`

Provide a concise summary, root cause analysis, and actionable suggestions in Markdown format.
`.trim()
  }

  private async callGemini(config: AIProviderConfig, prompt: string, history?: any[]): Promise<AIAnalysisResult> {
    const contents: any[] = []
    if (history) {
      history.forEach(m => contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] })

    const response = await fetch(`${config.apiUrl}?key=${config.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    })

    if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`)
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    return { summary: '', rootCause: '', suggestions: [], confidence: 1.0, rawText: text }
  }

  private async callOpenAI(config: AIProviderConfig, prompt: string, history?: any[]): Promise<AIAnalysisResult> {
    const messages: any[] = []
    if (history) {
      history.forEach(m => messages.push({ role: m.role, content: m.content }))
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
        messages
      })
    })

    if (!response.ok) throw new Error(`OpenAI API Error: ${response.statusText}`)
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    
    return { summary: '', rootCause: '', suggestions: [], confidence: 1.0, rawText: text }
  }

  private async callClaude(config: AIProviderConfig, prompt: string, history?: any[]): Promise<AIAnalysisResult> {
    // Basic implementation for Claude Messages API
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
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) throw new Error(`Claude API Error: ${response.statusText}`)
    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    
    return { summary: '', rootCause: '', suggestions: [], confidence: 1.0, rawText: text }
  }
}
