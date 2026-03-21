export type LogLevel = 'V' | 'D' | 'I' | 'W' | 'E'

export interface LogEntry {
  id: number
  timestamp: string
  pid: number
  tid: number
  level: LogLevel
  tag: string
  message: string
  deviceSerial: string
  raw: string
  sessionId?: number
}

export interface Device {
  serial: string
  type: 'usb' | 'wifi'
  model: string
  androidVersion: string
  status: 'device' | 'offline' | 'unauthorized'
  product?: string
}

export interface Issue {
  id: string
  type: 'crash' | 'anr' | 'performance' | 'custom'
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  logIds: number[]
  timestamp: string
  deviceSerial: string
}

export interface Session {
  id: number
  name: string
  deviceSerial: string
  deviceName: string
  startedAt: string
  endedAt?: string
}

export interface Bookmark {
  id: number
  logId: number
  note: string
  color: string
  createdAt: string
}

export interface LogFilter {
  levels: LogLevel[]
  tag: string
  keyword: string
  regex: boolean
  pid: number | null
  timeStart: string | null
  timeEnd: string | null
}

export interface CollectorOptions {
  filter?: string
  bufferSize?: 'default' | 'large'
}

export interface ProcessInfo {
  pid: number
  name: string
}

export interface AIChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type AIProviderType = 'gemini' | 'openai' | 'claude' | 'custom'

export interface AIProviderConfig {
  id: string
  name: string
  type: AIProviderType
  apiKey: string
  apiUrl: string
  model: string
  enabled: boolean
}

export interface AIAnalysisResult {
  summary: string
  rootCause: string
  suggestions: string[]
  confidence: number
  rawText?: string // 增加纯文本支持
}

export interface AIAnalysisRequest {
  logs: LogEntry[]
  context?: string
  history?: AIChatMessage[]
  providerConfig: AIProviderConfig
}
