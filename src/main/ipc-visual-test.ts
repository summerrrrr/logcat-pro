// 主进程 IPC 接口 - 暴露给渲染进程调用

import { ipcMain } from 'electron'
import { VisualTestRunner } from '../visual-test-runner'
import { AdbController } from './adb/AdbController'
import type { TestCase } from '../test-automation/core/types'

let testRunner: VisualTestRunner | null = null

export function registerVisualTestIpc(adbController: AdbController) {
  // 初始化测试运行器
  ipcMain.handle('visual-test:init', async (_, apiKey: string) => {
    testRunner = new VisualTestRunner(apiKey, adbController)
    return { success: true }
  })

  // 运行测试
  ipcMain.handle('visual-test:run', async (_, testCase: TestCase) => {
    if (!testRunner) {
      throw new Error('测试运行器未初始化')
    }
    return await testRunner.runTest(testCase)
  })
}
