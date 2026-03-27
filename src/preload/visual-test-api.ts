// Preload - 暴露给渲染进程的 API

import { contextBridge, ipcRenderer } from 'electron'
import type { TestCase, TestResult } from '../test-automation/core/types'

contextBridge.exposeInMainWorld('visualTest', {
  // 初始化测试运行器
  init: (apiKey: string) => ipcRenderer.invoke('visual-test:init', apiKey),

  // 运行测试
  run: (testCase: TestCase): Promise<TestResult> =>
    ipcRenderer.invoke('visual-test:run', testCase)
})
