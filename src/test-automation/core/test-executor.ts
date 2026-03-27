import type { TestStep, StepResult } from '../core/types'
import type { AIVisionAnalyzer } from '../ai/vision-analyzer'
import { AndroidAdapter } from '../adapters/android-adapter'

export class TestExecutor {
  constructor(
    private androidAdapter: AndroidAdapter,
    private aiAnalyzer: AIVisionAnalyzer
  ) {}

  async executeStep(step: TestStep): Promise<StepResult> {
    if (step.target === 'android') {
      return await this.androidAdapter.execute(step, this.aiAnalyzer)
    }

    throw new Error(`Unsupported target: ${step.target}`)
  }
}
