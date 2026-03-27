import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { writeFile, readFile, mkdir, rm } from 'fs/promises'
import { join, basename } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { AdbManager } from './adb/AdbManager'
import { LogCollector } from './collector/LogCollector'
import { LogStore } from './storage/LogStore'
import { Analyzer } from './analyzer/Analyzer'
import { LLMManager } from './ai/LLMManager'
import { PDFGenerator } from './ai/PDFGenerator'
import { LogEntry, AIAnalysisRequest, AIProviderType } from '../shared/types'

const execPromise = promisify(exec)

let adbManager: AdbManager
let logCollector: LogCollector
let analyzer: Analyzer
let logStore: LogStore | null = null
let llmManager: LLMManager
let pdfGenerator: PDFGenerator
const inMemoryLogs: Map<string, LogEntry[]> = new Map()

async function getLogStore(): Promise<LogStore> {
  if (!logStore) {
    logStore = new LogStore()
    await logStore.init()
  }
  return logStore
}

export function setupIpc(mainWindow: BrowserWindow): void {
  adbManager = new AdbManager()
  logCollector = new LogCollector()
  analyzer = new Analyzer()
  llmManager = new LLMManager()
  pdfGenerator = new PDFGenerator()

  // AI
  ipcMain.handle('config:setGeminiKey', async (_e, key: string) => {
    // Basic handler to avoid 'No handler registered' error
    return true
  })

  ipcMain.handle('config:setGeminiConfig', async (_e, config: { key: string, url: string }) => {
    // Basic handler to avoid 'No handler registered' error
    return true
  })

  ipcMain.handle('analysis:analyzeAI', async (_e, request: AIAnalysisRequest) => {
    return await llmManager.analyze(request)
  })

  ipcMain.handle('config:fetchModels', async (_e, type: AIProviderType, apiKey: string, apiUrl: string) => {
    return await llmManager.fetchModels(type, apiKey, apiUrl)
  })

  ipcMain.handle('analysis:exportPDF', async (_e, analysis: string, errorLog: LogEntry, contextLogs: LogEntry[], defaultPath?: string) => {
    const defaultName = `log_analysis_${Date.now()}.pdf`
    const initialPath = defaultPath ? join(defaultPath, defaultName) : join(app.getPath('downloads'), defaultName)
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出 PDF 报告',
      defaultPath: initialPath,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return null
    await pdfGenerator.generateAnalysisReport(filePath, analysis, errorLog, contextLogs)
    return filePath
  })

  // Device
  ipcMain.handle('device:list', async () => adbManager.listDevices())
  ipcMain.handle('device:reboot', async (_e, serial: string) => adbManager.reboot(serial))
  ipcMain.handle('device:shutdown', async (_e, serial: string) => adbManager.shutdown(serial))
  ipcMain.handle('device:screenshot', async (_e, serial: string) => {
    const buffer = await adbManager.takeScreenshot(serial)
    return `data:image/png;base64,${buffer.toString('base64')}`
  })
  ipcMain.handle('device:connect-wifi', async (_e, ip: string, port: number) => adbManager.connectWifi(ip, port))
  ipcMain.handle('device:list-processes', async (_e, serial: string) => adbManager.listProcesses(serial))
  ipcMain.handle('device:get-performance', async (_e, serial: string, pid: number) => adbManager.getProcessPerformance(serial, pid))
  ipcMain.handle('device:clear-process-stats', async (_e, serial: string, pid: number) => adbManager.clearProcessStats(serial, pid))
  ipcMain.handle('device:list-dir', async (_e, serial: string, path: string) => adbManager.listDirectory(serial, path))
  ipcMain.handle('device:read-file', async (_e, serial: string, path: string) => adbManager.readFile(serial, path))
  ipcMain.handle('device:disconnect-all', async () => adbManager.disconnectAll())

  ipcMain.on('device:watch-start', () => {
    adbManager.watchDevices()
    adbManager.removeAllListeners('device-connected')
    adbManager.on('device-connected', (device) => mainWindow.webContents.send('device:connected', device))
    adbManager.removeAllListeners('device-disconnected')
    adbManager.on('device-disconnected', (device) => mainWindow.webContents.send('device:disconnected', device))
  })

  ipcMain.on('device:watch-stop', () => adbManager.stopWatching())

  // Log
  ipcMain.handle('log:start', async (_e, serial: string, options?: any) => {
    logCollector.start(serial, options)
    if (!inMemoryLogs.has(serial)) inMemoryLogs.set(serial, [])
  })

  logCollector.on('logs', (serial: string, logs: LogEntry[]) => {
    const existing = inMemoryLogs.get(serial) || []
    if (existing.length + logs.length > 500000) {
      existing.splice(0, existing.length + logs.length - 500000)
    }
    existing.push(...logs)
    inMemoryLogs.set(serial, existing)
    mainWindow.webContents.send('log:data', logs)
  })

  logCollector.on('error', (serial: string, error: Error) => {
    mainWindow.webContents.send('log:error', serial, error.message)
  })

  logCollector.on('close', (serial: string, code: number | null) => {
    mainWindow.webContents.send('log:stopped', serial, code)
  })

  ipcMain.handle('log:stop', async (_e, serial: string) => logCollector.stop(serial))
  ipcMain.handle('log:pause', async (_e, serial: string) => logCollector.pause(serial))
  ipcMain.handle('log:resume', async (_e, serial: string) => logCollector.resume(serial))
  ipcMain.handle('log:clear', async (_e, serial: string) => inMemoryLogs.set(serial, []))

  // Storage
  ipcMain.handle('storage:export', async (_e, serial?: string, options?: { defaultPath?: string, logs?: LogEntry[] }) => {
    const logsToExport = options?.logs || (serial ? (inMemoryLogs.get(serial) || []) : [])
    if (logsToExport.length === 0) return null
    
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '选择导出目录',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: options?.defaultPath || app.getPath('downloads')
    })
    
    if (canceled || filePaths.length === 0) return null
    const targetDir = filePaths[0]

    try {
      const MAX_FILE_SIZE = 100 * 1024 * 1024
      const timestamp = Date.now()
      let totalSize = 0
      for (const log of logsToExport) totalSize += Buffer.byteLength((log.raw || '') + '\n', 'utf-8')
      const isMultiFile = totalSize > MAX_FILE_SIZE
      let currentFileIndex = 1
      let currentBatch: string[] = []
      let currentBatchSize = 0
      const getFileName = (index: number) => {
        const base = `logs_${serial || 'device'}_${timestamp}`
        return isMultiFile ? `${base}_part${index}.log` : `${base}.log`
      }
      for (const log of logsToExport) {
        const line = (log.raw || '') + '\n'
        const lineSize = Buffer.byteLength(line, 'utf-8')
        if (currentBatchSize + lineSize > MAX_FILE_SIZE && currentBatch.length > 0) {
          await writeFile(join(targetDir, getFileName(currentFileIndex)), currentBatch.join(''), 'utf-8')
          currentFileIndex++
          currentBatch = []
          currentBatchSize = 0
        }
        currentBatch.push(line)
        currentBatchSize += lineSize
      }
      if (currentBatch.length > 0) {
        await writeFile(join(targetDir, getFileName(currentFileIndex)), currentBatch.join(''), 'utf-8')
      }
      return targetDir
    } catch (error: any) {
      console.error('Export failed:', error)
      throw error
    }
  })

  ipcMain.handle('storage:open-local-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '打开本地日志文件',
      properties: ['openFile'],
      filters: [{ name: '日志/文本', extensions: ['log', 'txt', 'json', 'xml'] }]
    })
    if (canceled || filePaths.length === 0) return null
    const targetPath = filePaths[0]
    const content = await readFile(targetPath, 'utf-8')
    return { path: targetPath, name: basename(targetPath), content }
  })

  ipcMain.handle('storage:select-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '选择保存目录',
      properties: ['openDirectory']
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  ipcMain.handle('storage:save-screenshot', async (e, data: string, serial: string, defaultPath?: string) => {
    const win = BrowserWindow.fromWebContents(e.sender) || mainWindow
    const buffer = Buffer.from(data.replace(/^data:image\/png;base64,/, ''), 'base64')
    const defaultName = `screenshot_${serial}_${Date.now()}.png`
    const initialPath = defaultPath ? join(defaultPath, defaultName) : join(app.getPath('downloads'), defaultName)
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '保存截图',
      defaultPath: initialPath,
      filters: [{ name: 'Images', extensions: ['png'] }],
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, buffer)
    return filePath
  })

  ipcMain.handle('storage:get-sessions', async () => {
    const store = await getLogStore()
    return store.getSessions()
  })

  ipcMain.handle('storage:clean', async (_e, days: number) => {
    const store = await getLogStore()
    return store.clean(days)
  })

  // Window
  ipcMain.on('window:minimize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) win.minimize()
  })
  ipcMain.on('window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) {
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    }
  })
  ipcMain.on('window:close', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) win.close()
  })
  ipcMain.on('window:open-screenshot', (_e, screenshotData, serial) => {
    const { createScreenshotWindow } = require('./index')
    createScreenshotWindow(screenshotData, serial, mainWindow)
  })

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized-change', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized-change', false))
}

export function disposeIpc(): void {
  if (adbManager) adbManager.dispose()
  if (logCollector) logCollector.stopAll()
  inMemoryLogs.clear()
}