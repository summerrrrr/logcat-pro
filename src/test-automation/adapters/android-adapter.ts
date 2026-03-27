import type { TestStep, StepResult } from '../core/types'
import type { AIVisionAnalyzer } from '../ai/vision-analyzer'

export class AndroidAdapter {
  constructor(private adbController: any) {}

  async execute(step: TestStep, ai: AIVisionAnalyzer): Promise<StepResult> {
    const startTime = Date.now()

    try {
      const screenshot = await this.captureScreen()

      if (step.action === 'tap' && step.element) {
        const location = await ai.findElement(screenshot, step.element)
        await this.adbController.tap(location.x, location.y)
      }

      if (step.action === 'swipe' && step.element) {
        const area = await ai.findElement(screenshot, step.element)
        await this.adbController.swipe(
          area.x,
          area.y + area.height * 0.8,
          area.x,
          area.y + area.height * 0.2,
          300
        )
      }

      await this.sleep(1000)
      const passed = await this.verify(step, ai)

      return {
        stepIndex: 0,
        passed,
        screenshot: screenshot.toString('base64')
      }
    } catch (error) {
      return {
        stepIndex: 0,
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async captureScreen(): Promise<Buffer> {
    return await this.adbController.captureScreen()
  }

  private async verify(step: TestStep, ai: AIVisionAnalyzer): Promise<boolean> {
    if (!step.verify?.visual) return true
    const screenshot = await this.captureScreen()
    return await ai.verifyScreen(screenshot, step.verify.visual)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
