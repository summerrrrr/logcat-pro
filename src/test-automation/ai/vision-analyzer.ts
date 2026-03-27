import Anthropic from '@anthropic-ai/sdk'
import type { ElementLocation } from '../core/types'

export class AIVisionAnalyzer {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async findElement(screenshot: Buffer, description: string): Promise<ElementLocation> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshot.toString('base64')
              }
            },
            {
              type: 'text',
              text: `定位元素: ${description}。返回JSON: {"x": 0, "y": 0, "width": 0, "height": 0, "confidence": 0.95}`
            }
          ]
        }
      ]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    return JSON.parse(text)
  }

  async verifyScreen(screenshot: Buffer, expectation: string): Promise<boolean> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshot.toString('base64')
              }
            },
            {
              type: 'text',
              text: `验证截图是否符合: ${expectation}。返回JSON: {"passed": true/false, "reason": "原因"}`
            }
          ]
        }
      ]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const result = JSON.parse(text)
    return result.passed
  }
}
