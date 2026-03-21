import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  device: {
    list: () => ipcRenderer.invoke('device:list'),
    watchStart: () => ipcRenderer.send('device:watch-start'),
    watchStop: () => ipcRenderer.send('device:watch-stop'),
    connectWifi: (ip: string, port: number) => ipcRenderer.invoke('device:connect-wifi', ip, port),
    disconnectAll: () => ipcRenderer.invoke('device:disconnect-all'),
    reboot: (serial: string) => ipcRenderer.invoke('device:reboot', serial),
    shutdown: (serial: string) => ipcRenderer.invoke('device:shutdown', serial),
    screenshot: (serial: string) => ipcRenderer.invoke('device:screenshot', serial),
    listProcesses: (serial: string) => ipcRenderer.invoke('device:list-processes', serial),
    getPerformance: (serial: string, pid: number) => ipcRenderer.invoke('device:get-performance', serial, pid),
    listDir: (serial: string, path: string) => ipcRenderer.invoke('device:list-dir', serial, path),
    readFile: (serial: string, path: string) => ipcRenderer.invoke('device:read-file', serial, path),
    onChanged: (callback: (devices: unknown[]) => void) => {
      ipcRenderer.on('device:changed', (_event, devices) => callback(devices))
      return () => ipcRenderer.removeAllListeners('device:changed')
    },
    onConnected: (callback: (device: unknown) => void) => {
      ipcRenderer.on('device:connected', (_event, device) => callback(device))
      return () => ipcRenderer.removeAllListeners('device:connected')
    },
    onDisconnected: (callback: (device: unknown) => void) => {
      ipcRenderer.on('device:disconnected', (_event, device) => callback(device))
      return () => ipcRenderer.removeAllListeners('device:disconnected')
    }
  },
  log: {
    start: (serial: string, options?: object) => ipcRenderer.invoke('log:start', serial, options),
    stop: (serial: string) => ipcRenderer.invoke('log:stop', serial),
    pause: (serial: string) => ipcRenderer.invoke('log:pause', serial),
    resume: (serial: string) => ipcRenderer.invoke('log:resume', serial),
    clear: (serial: string) => ipcRenderer.invoke('log:clear', serial),
    onData: (callback: (data: unknown[]) => void) => {
      ipcRenderer.on('log:data', (_event, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('log:data')
    },
    onError: (callback: (serial: string, message: string) => void) => {
      ipcRenderer.on('log:error', (_event, serial, message) => callback(serial, message))
      return () => ipcRenderer.removeAllListeners('log:error')
    },
    onStopped: (callback: (serial: string, code: number | null) => void) => {
      ipcRenderer.on('log:stopped', (_event, serial, code) => callback(serial, code))
      return () => ipcRenderer.removeAllListeners('log:stopped')
    }
  },
  storage: {
    search: (query: string, options?: object) => ipcRenderer.invoke('storage:search', query, options),
    export: (serial?: string, options?: object) => ipcRenderer.invoke('storage:export', serial, options),
    openLocalFile: () => ipcRenderer.invoke('storage:open-local-file'),
    selectDirectory: () => ipcRenderer.invoke('storage:select-directory'),
    saveScreenshot: (data: string, serial: string, defaultPath?: string) => 
      ipcRenderer.invoke('storage:save-screenshot', data, serial, defaultPath),
    getSessions: () => ipcRenderer.invoke('storage:get-sessions'),
    clean: (days: number) => ipcRenderer.invoke('storage:clean', days)
  },
  config: {
    setGeminiKey: (key: string) => ipcRenderer.invoke('config:setGeminiKey', key),
    setGeminiConfig: (config: { key: string, url: string }) => ipcRenderer.invoke('config:setGeminiConfig', config),
    onOpenSettings: (callback: (tab: string) => void) => {
      ipcRenderer.on('menu:open-settings', (_event, tab) => callback(tab))
      return () => ipcRenderer.removeAllListeners('menu:open-settings')
    }
  },
  analysis: {
    run: (serial?: string) => ipcRenderer.invoke('analysis:run', serial),
    analyzeAI: (request: any) => ipcRenderer.invoke('analysis:analyzeAI', request),
    exportPDF: (analysis: string, errorLog: any, contextLogs: any[], defaultPath?: string) => 
      ipcRenderer.invoke('analysis:exportPDF', analysis, errorLog, contextLogs, defaultPath),
    getRules: () => ipcRenderer.invoke('analysis:get-rules'),
    onIssue: (callback: (issue: unknown) => void) => {
      ipcRenderer.on('analysis:issue', (_event, issue) => callback(issue))
      return () => ipcRenderer.removeAllListeners('analysis:issue')
    }
  },
  bookmark: {
    add: (logId: number, note: string, color: string) => ipcRenderer.invoke('bookmark:add', logId, note, color),
    remove: (id: number) => ipcRenderer.invoke('bookmark:remove', id),
    list: () => ipcRenderer.invoke('bookmark:list'),
    update: (id: number, note: string, color: string) => ipcRenderer.invoke('bookmark:update', id, note, color)
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    openScreenshotWindow: (data: string, serial: string) => ipcRenderer.send('window:open-screenshot', data, serial),
    onMaximizedChange: (callback: (state: boolean) => void) => {
      ipcRenderer.on('window:maximized-change', (_event, isMaximized) => callback(isMaximized))
      return () => ipcRenderer.removeAllListeners('window:maximized-change')
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
