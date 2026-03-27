import type { TestCase, TestResult, StepResult } from '../core/types'
import { TestExecutor } from './test-executor'

export class TestOrchestrator {
  constructor(private executor: TestExecutor) {}

  async run(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now()
    const results: StepResult[] = []
    const screenshots: string[] = []

    for (let i = 0; i < testCase.steps.length; i++) {
      const step = testCase.steps[i]
      const result = await this.executor.executeStep(step)
      result.stepIndex = i
      results.push(result)

      if (result.screenshot) {
        screenshots.push(result.screenshot)
      }

      if (!result.passed) break
    }

    const passed = results.every((r) => r.passed)
    const duration = Date.now() - startTime

    return {
      testId: testCase.id,
      passed,
      duration,
      steps: results,
      screenshots
    }
  }
}
