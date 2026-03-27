// 测试自动化核心类型定义

export interface TestCase {
  id: string
  name: string
  description: string
  steps: TestStep[]
  timeout?: number
}

export interface TestStep {
  action: 'tap' | 'swipe' | 'input' | 'verify' | 'wait'
  target: 'electron' | 'android'
  element?: string
  params?: Record<string, any>
  verify?: VerifyCondition
}

export interface VerifyCondition {
  visual?: string
  text?: string
  timing?: string
}

export interface ElementLocation {
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

export interface TestResult {
  testId: string
  passed: boolean
  duration: number
  steps: StepResult[]
  screenshots: string[]
}

export interface StepResult {
  stepIndex: number
  passed: boolean
  error?: string
  screenshot?: string
  aiConfidence?: number
}
