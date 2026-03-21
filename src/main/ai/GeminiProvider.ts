import { AIAnalysisRequest, AIAnalysisResult, LogEntry } from '../../shared/types'

export class GeminiProvider {
  private apiKey: string = ''
  private apiUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'

  constructor(apiKey: string, apiUrl?: string) {
    this.apiKey = apiKey
    if (apiUrl && apiUrl.trim() !== '') {
      this.apiUrl = apiUrl.trim()
    }
  }

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    console.log('[GeminiProvider] Starting analysis request...');
    if (!this.apiKey) {
      console.error('[GeminiProvider] Error: Gemini API Key is not configured.');
      throw new Error('Gemini API Key is not configured.')
    }

    const contents: any[] = []
    
    // 如果有历史记录，先构建对话上下文
    if (request.history && request.history.length > 0) {
      for (let i = 0; i < request.history.length - 1; i++) {
        const msg = request.history[i]
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })
      }
    }

    // 构建当前轮次的 Prompt
    const currentPrompt = this.buildPrompt(request.logs, request.context)
    contents.push({
      role: 'user',
      parts: [{ text: currentPrompt }]
    })

    // System Instruction (for newer models)
    const systemInstruction = {
      parts: [{ text: "You are an expert Android System Engineer. Provide direct, helpful, and concise answers using Markdown. Do NOT use JSON formatting unless explicitly asked." }]
    }
    
    // Support custom API URLs that might be just base domains
    let finalUrl = this.apiUrl;
    if (!finalUrl.includes('/v1beta') && !finalUrl.includes('/v1')) {
      // Append default path if it looks like a base domain
      finalUrl = finalUrl.replace(/\/+$/, '') + '/v1beta/models/gemini-pro:generateContent';
    }

    const logSafeUrl = `${finalUrl.split('?')[0]}?key=${this.apiKey.substring(0, 5)}...`
    console.log(`[GeminiProvider] Sending request to: ${logSafeUrl}`);
    
    try {
      // Many domestic relays require the key in headers or support it there for security
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      }

      const fetchUrl = finalUrl.includes('?') 
        ? `${finalUrl}&key=${this.apiKey}` 
        : `${finalUrl}?key=${this.apiKey}`;

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contents,
          systemInstruction // Optional for v1beta, helps set persona
        })
      })

      const responseText = await response.text()

      if (!response.ok) {
        let errorData
        try {
          errorData = JSON.parse(responseText)
        } catch (e) {
          errorData = responseText
        }
        console.error(
          `[GeminiProvider] API Error [Status: ${response.status} ${response.statusText}]:`,
          JSON.stringify(errorData, null, 2)
        )
        throw new Error(
          `Gemini API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        )
      }

      const data = JSON.parse(responseText)
      console.log('[GeminiProvider] Successfully received response from API.')

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!text) {
        console.warn('[GeminiProvider] Warning: Response was OK, but extracted text is empty. Raw data:', JSON.stringify(data, null, 2));
      }
      
      // 直接返回纯文本作为 rawText
      return {
        summary: '',
        rootCause: '',
        suggestions: [],
        confidence: 1.0,
        rawText: text
      }
    } catch (e: any) {
      console.error('[GeminiProvider] Fetch or execution failed:', e.message);
      if (e.cause) console.error('[GeminiProvider] Error cause:', e.cause);
      throw e
    }
  }

  private buildPrompt(logs: LogEntry[], context?: string): string {
    const logsText = logs.length > 0 
      ? logs.map(l => `${l.timestamp} ${l.level}/${l.tag}(${l.pid}): ${l.message}`).join('\n')
      : ''
    
    let prompt = ''
    if (context) {
      prompt += `${context}\n\n`
    }
    if (logsText) {
      prompt += `Reference Logs:\n\`\`\`\n${logsText}\n\`\`\`\n`
    }
    
    return prompt.trim() || 'Hello, I need some Android development help.'
  }

  private parseResponse(text: string): AIAnalysisResult {
    try {
      // Find JSON block if present, otherwise try parsing whole text
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : text
      const parsed = JSON.parse(jsonStr)
      
      return {
        summary: parsed.summary || 'No summary provided',
        rootCause: parsed.rootCause || 'Unknown root cause',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
      }
    } catch (e) {
      return {
        summary: 'Failed to parse AI response',
        rootCause: text,
        suggestions: ['Manual investigation recommended'],
        confidence: 0
      }
    }
  }
}
