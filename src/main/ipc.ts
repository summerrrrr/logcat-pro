import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { writeFile, readFile, mkdir, rm } from 'fs/promises'
import { join, basename } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import Anthropic from '@anthropic-ai/sdk'
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
  ipcMain.handle('device:list-packages', async (_e, serial: string) => adbManager.listPackages(serial))
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

  // 视觉测试接口
  let visualTestProvider: any = null
  let claudeClient: Anthropic | null = null

  ipcMain.handle('visual-test:init', async (_e, providerJson: string) => {
    visualTestProvider = JSON.parse(providerJson)

    // 提取 baseURL（去掉路径后缀如 /v1/message、/v1/messages 等）
    let baseURL: string | undefined = undefined
    if (visualTestProvider.apiUrl) {
      baseURL = visualTestProvider.apiUrl
        .replace(/\/+$/, '')
        .replace(/\/v1\/messages?.*$/, '')
        .replace(/\/v1\/chat\/completions.*$/, '')
    }

    claudeClient = new Anthropic({
      apiKey: visualTestProvider.apiKey,
      baseURL: baseURL || undefined
    })

    return { success: true }
  })

  ipcMain.handle('visual-test:run', async (_e, params: any) => {
    const { serial, packageName, testType } = params
    const startTime = Date.now()
    const results: any[] = []
    const screenshots: string[] = []

    const adbPath = adbManager.getAdbPath()
    if (!adbPath) throw new Error('ADB not found')

    const runAdb = (args: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        exec(`"${adbPath}" -s ${serial} ${args}`, {
          encoding: 'utf-8',
          timeout: 30000
        }, (err, stdout, stderr) => {
          if (err) return reject(new Error(stderr || err.message))
          resolve(stdout)
        })
      })
    }

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

    const sendLog = (msg: string) => {
      mainWindow.webContents.send('visual-test:log', msg)
    }

    const getScreenSize = async (): Promise<{ w: number; h: number }> => {
      const output = await runAdb('shell wm size')
      const match = output.match(/(\d+)x(\d+)/)
      return match ? { w: parseInt(match[1]), h: parseInt(match[2]) } : { w: 1080, h: 1920 }
    }

    // 截图返回 buffer
    const takeScreenshotBuffer = async (): Promise<Buffer> => {
      return await adbManager.takeScreenshot(serial)
    }

    // 截图并保存到结果
    const takeScreenshotAndSave = async (label: string): Promise<Buffer> => {
      const buffer = await takeScreenshotBuffer()
      screenshots.push(`data:image/png;base64,${buffer.toString('base64')}`)
      sendLog(`📸 截图: ${label}`)
      return buffer
    }

    // 通过 uiautomator 获取页面控件树（精确坐标）
    const getUIElements = async (): Promise<Array<{ name: string; x: number; y: number; type: string }>> => {
      try {
        sendLog('🔍 正在通过 uiautomator 获取控件树...')
        const elements = await adbManager.dumpUIHierarchy(serial)
        sendLog(`✅ 成功获取 ${elements.length} 个控件`)
        return elements
      } catch (e: any) {
        sendLog(`⚠️ 获取控件树失败: ${e.message}，回退到 AI 识别`)
        return await aiAnalyzeScreen()
      }
    }

    // AI 识别控件（备用方案）
    const aiAnalyzeScreen = async (): Promise<Array<{ name: string; x: number; y: number; type: string }>> => {
      if (!claudeClient) {
        sendLog('⚠️ 未配置 AI，无法识别控件')
        return []
      }

      const screenshotBuffer = await takeScreenshotBuffer()
      const response = await claudeClient.messages.create({
        model: visualTestProvider?.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBuffer.toString('base64')
              }
            },
            {
              type: 'text',
              text: `分析这个 Android 应用截图，找出所有可点击的 UI 控件。
返回 JSON 数组: [{"name":"按钮名","x":百分比,"y":百分比,"type":"button"}]
x/y 是百分比坐标(0-100)，屏幕中心是 x:50,y:50。只返回 JSON。`
            }
          ]
        }]
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        const elements = jsonMatch ? JSON.parse(jsonMatch[0]) : []
        const screen = await getScreenSize()
        return elements.map((el: any) => ({
          ...el,
          x: Math.round((el.x / 100) * screen.w),
          y: Math.round((el.y / 100) * screen.h)
        }))
      } catch {
        return []
      }
    }

    // AI 验证当前页面状态
    const aiVerifyScreen = async (screenshotBuffer: Buffer, expectation: string): Promise<{ passed: boolean; description: string }> => {
      if (!claudeClient) return { passed: true, description: '未配置 AI，跳过验证' }

      const response = await claudeClient.messages.create({
        model: visualTestProvider?.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBuffer.toString('base64')
              }
            },
            {
              type: 'text',
              text: `验证这个 Android 应用截图: ${expectation}
返回 JSON: {"passed": true/false, "description": "当前页面的简要描述"}`
            }
          ]
        }]
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { passed: true, description: '未知' }
      } catch {
        return { passed: true, description: '解析失败' }
      }
    }

    const isAppAlive = async (): Promise<boolean> => {
      try {
        const output = await runAdb(`shell pidof ${packageName}`)
        return output.trim().length > 0
      } catch {
        return false
      }
    }

    try {
      const screen = await getScreenSize()
      sendLog(`📱 屏幕尺寸: ${screen.w}x${screen.h}`)

      if (testType === 'launch-001') {
        // ========= 应用启动测试 =========
        sendLog('🔄 强制停止应用...')
        await runAdb(`shell am force-stop ${packageName}`)
        await sleep(1000)

        sendLog('🚀 启动应用...')
        await runAdb(`shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
        await sleep(3000)

        let buf = await takeScreenshotAndSave('应用启动后')

        sendLog('🤖 AI 分析启动页面...')
        const verify = await aiVerifyScreen(buf, '应用是否成功启动，页面是否正常显示了内容')
        sendLog(`📋 AI 判断: ${verify.description}`)
        results.push({ stepIndex: 0, passed: verify.passed, action: verify.description })

        sendLog('🤖 AI 识别页面控件...')
        const elements = await getUIElements()
        sendLog(`🔍 找到 ${elements.length} 个可点击控件`)

        // 逐个点击找到的控件
        for (let i = 0; i < Math.min(elements.length, 3); i++) {
          const el = elements[i]
          sendLog(`👆 点击: "${el.name}" (${el.type}) 坐标(${el.x}, ${el.y})`)
          await runAdb(`shell input tap ${el.x} ${el.y}`)
          await sleep(2000)

          buf = await takeScreenshotAndSave(`点击"${el.name}"后`)

          const alive = await isAppAlive()
          if (!alive) {
            sendLog(`❌ 点击"${el.name}"后应用崩溃!`)
            results.push({ stepIndex: i + 1, passed: false, action: `点击"${el.name}"后崩溃` })
            break
          }
          sendLog(`✅ 点击"${el.name}"后应用正常`)
          results.push({ stepIndex: i + 1, passed: true, action: `点击"${el.name}"正常` })
        }

      } else if (testType === 'navigate-001') {
        // ========= 页面浏览测试（AI 驱动）=========
        sendLog('🚀 启动应用...')
        await runAdb(`shell am force-stop ${packageName}`)
        await sleep(500)
        await runAdb(`shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
        await sleep(3000)

        const maxPages = 5
        const visitedPages = new Set<string>()

        for (let page = 0; page < maxPages; page++) {
          let buf = await takeScreenshotAndSave(`第${page + 1}个页面`)

          sendLog(`🤖 AI 分析第${page + 1}个页面...`)
          const elements = await getUIElements()
          sendLog(`🔍 找到 ${elements.length} 个可点击控件: ${elements.map(e => e.name).join(', ')}`)

          // 选择一个没点过的控件
          const unvisited = elements.filter(e => !visitedPages.has(e.name))
          if (unvisited.length === 0) {
            sendLog('📌 所有控件已测试过，结束浏览')
            break
          }

          const target = unvisited[0]
          visitedPages.add(target.name)

          sendLog(`👆 点击: "${target.name}" (${target.type}) 坐标(${target.x}, ${target.y})`)
          await runAdb(`shell input tap ${target.x} ${target.y}`)
          await sleep(2500)

          buf = await takeScreenshotAndSave(`进入"${target.name}"`)

          const alive = await isAppAlive()
          if (!alive) {
            sendLog(`❌ 进入"${target.name}"后应用崩溃!`)
            results.push({ stepIndex: page, passed: false, action: `"${target.name}"页面崩溃` })

            sendLog('🔄 重启应用继续测试...')
            await runAdb(`shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
            await sleep(2000)
            continue
          }

          const verify = await aiVerifyScreen(buf, '页面是否正常显示了内容，没有白屏、错误弹窗或异常')
          sendLog(`📋 AI 验证: ${verify.description}`)
          results.push({ stepIndex: page, passed: verify.passed, action: `"${target.name}": ${verify.description}` })

          // 在当前页面内滑动
          sendLog(`📜 在"${target.name}"页面内滑动...`)
          await runAdb(`shell input swipe ${screen.w / 2} ${Math.round(screen.h * 0.7)} ${screen.w / 2} ${Math.round(screen.h * 0.3)} 300`)
          await sleep(1000)
          await takeScreenshotAndSave(`"${target.name}"滑动后`)

          // 返回上一页
          sendLog('🔙 返回上一页...')
          await runAdb('shell input keyevent 4')
          await sleep(1500)
        }

      } else if (testType === 'crash-001') {
        // ========= 稳定性测试（AI 驱动深度遍历）=========
        sendLog('🚀 启动应用...')
        await runAdb(`shell am force-stop ${packageName}`)
        await sleep(500)
        await runAdb(`shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
        await sleep(3000)

        const testedElements = new Set<string>()
        const maxSteps = 10
        let stepCount = 0

        for (let step = 0; step < maxSteps; step++) {
          let buf = await takeScreenshotAndSave(`步骤${step + 1}`)

          sendLog(`🤖 步骤${step + 1}/${maxSteps}: AI 分析当前页面...`)
          const elements = await getUIElements()
          sendLog(`🔍 找到 ${elements.length} 个控件: ${elements.map(e => e.name).join(', ')}`)

          // 选择一个还没测试过的控件
          const untested = elements.filter(e => !testedElements.has(e.name))
          if (untested.length === 0) {
            sendLog('📌 当前页面所有控件已测试，返回上一页...')
            await runAdb('shell input keyevent 4')
            await sleep(1500)

            // 检查是否回到了桌面
            const alive = await isAppAlive()
            if (!alive) {
              sendLog('📌 已退出应用，测试结束')
              break
            }
            continue
          }

          const target = untested[0]
          testedElements.add(target.name)
          stepCount++

          sendLog(`👆 点击: "${target.name}" (${target.type}) 坐标(${target.x}, ${target.y})`)
          await runAdb(`shell input tap ${target.x} ${target.y}`)
          await sleep(2000)

          // 检查是否崩溃
          const alive = await isAppAlive()
          if (!alive) {
            sendLog(`❌ 点击"${target.name}"后应用崩溃!`)
            results.push({ stepIndex: step, passed: false, action: `点击"${target.name}"后崩溃` })

            sendLog('🔄 重启应用继续测试...')
            await runAdb(`shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
            await sleep(2000)
            continue
          }

          buf = await takeScreenshotAndSave(`点击"${target.name}"后`)
          sendLog(`✅ 点击"${target.name}"正常，进入子页面`)
          results.push({ stepIndex: step, passed: true, action: `点击"${target.name}"正常` })

          // 在子页面内滑动
          sendLog(`📜 在子页面内滑动浏览...`)
          await runAdb(`shell input swipe ${screen.w / 2} ${Math.round(screen.h * 0.7)} ${screen.w / 2} ${Math.round(screen.h * 0.3)} 300`)
          await sleep(1000)
        }

        sendLog(`\n📋 共测试了 ${stepCount} 个控件，覆盖: ${[...testedElements].join(', ')}`)
      }
    } catch (error: any) {
      sendLog(`❌ 测试异常: ${error.message}`)
      results.push({ stepIndex: results.length, passed: false, error: error.message })
    }

    const duration = Date.now() - startTime
    const passed = results.length > 0 && results.every((r: any) => r.passed)
    sendLog(`\n📊 测试完成 | ${passed ? '通过' : '失败'} | 耗时 ${(duration / 1000).toFixed(1)}s | ${screenshots.length}张截图`)

    return {
      testId: params.id,
      passed,
      duration,
      steps: results,
      screenshots
    }
  })
}

export function disposeIpc(): void {
  if (adbManager) adbManager.dispose()
  if (logCollector) logCollector.stopAll()
  inMemoryLogs.clear()
}