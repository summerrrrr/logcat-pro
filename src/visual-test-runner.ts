// 视觉UI自动化测试 - 主入口
import { TestOrchestrator } from './test-automation/core/test-orchestrator'
import { TestExecutor } from './test-automation/core/test-executor'
import { AndroidAdapter } from './test-automation/adapters/android-adapter'
import { AIVisionAnalyzer } from './test-automation/ai/vision-analyzer'
import { AdbController } from './main/adb/AdbController'
import type { TestCase } from './test-automation/core/types'

export class VisualTestRunner {
  private orchestrator: TestOrchestrator

  constructor(claudeApiKey: string, adbController: AdbController) {
    const aiAnalyzer = new AIVisionAnalyzer(claudeApiKey)
    const androidAdapter = new AndroidAdapter(adbController)
    const executor = new TestExecutor(androidAdapter, aiAnalyzer)
    this.orchestrator = new TestOrchestrator(executor)
  }

  async runTest(testCase: TestCase) {
    console.log(`开始测试: ${testCase.name}`)
    const result = await this.orchestrator.run(testCase)

    console.log(`测试${result.passed ? '通过' : '失败'}`)
    console.log(`耗时: ${result.duration}ms`)

    return result
  }
}
