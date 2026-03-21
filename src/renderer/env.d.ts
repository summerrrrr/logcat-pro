/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ElectronAPI {
  device: {
    list(): Promise<import('../shared/types').Device[]>
    watchStart(): void
    watchStop(): void
    connectWifi(ip: string, port: number): Promise<string>
    listProcesses(serial: string): Promise<import('../shared/types').ProcessInfo[]>
    getPerformance(serial: string, pid: number): Promise<{ cpu: number, memory: number }>
    listDir(serial: string, path: string): Promise<{ name: string, isDir: boolean, size: number, date: string }[]>
    readFile(serial: string, path: string): Promise<string>
    onChanged(callback: (devices: import('../shared/types').Device[]) => void): () => void
    onConnected(callback: (device: import('../shared/types').Device) => void): () => void
    onDisconnected(callback: (device: import('../shared/types').Device) => void): () => void
  }
  log: {
    start(serial: string, options?: import('../shared/types').CollectorOptions): Promise<void>
    stop(serial: string): Promise<void>
    pause(serial: string): Promise<void>
    resume(serial: string): Promise<void>
    clear(serial: string): Promise<void>
    onData(callback: (data: import('../shared/types').LogEntry[]) => void): () => void
    onError(callback: (serial: string, message: string) => void): () => void
    onStopped(callback: (serial: string, code: number | null) => void): () => void
  }
  storage: {
    search(query: string, options?: object): Promise<import('../shared/types').LogEntry[]>
    export(format: string, filter?: object): Promise<string>
    openLocalFile(): Promise<{ path: string, name: string, content: string } | null>
    getSessions(): Promise<import('../shared/types').Session[]>
    clean(days: number): Promise<void>
  }
  analysis: {
    run(serial?: string): Promise<import('../shared/types').Issue[]>
    analyzeAI(request: import('../shared/types').AIAnalysisRequest): Promise<import('../shared/types').AIAnalysisResult>
    getRules(): Promise<string[]>
    onIssue(callback: (issue: import('../shared/types').Issue) => void): () => void
  }
  bookmark: {
    add(logId: number, note: string, color: string): Promise<number>
    remove(id: number): Promise<void>
    list(): Promise<import('../shared/types').Bookmark[]>
    update(id: number, note: string, color: string): Promise<void>
  }
  config: {
    setGeminiKey(key: string): Promise<boolean>
    onOpenSettings(callback: (tab: string) => void): () => void
  }
  window: {
    minimize(): void
    maximize(): void
    close(): void
    onMaximizedChange(callback: (isMaximized: boolean) => void): () => void
  }
}

interface Window {
  electronAPI: ElectronAPI
}
