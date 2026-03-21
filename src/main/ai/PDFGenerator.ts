import PDFDocument from 'pdfkit'
import { createWriteStream } from 'fs'
import { LogEntry } from '../../shared/types'

export class PDFGenerator {
  async generateAnalysisReport(
    filePath: string, 
    analysis: string, 
    errorLog: LogEntry, 
    contextLogs: LogEntry[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 })
      const stream = createWriteStream(filePath)

      doc.pipe(stream)

      // Header
      doc.fontSize(20).text('LogCat Pro - AI 诊断报告', { align: 'center' })
      doc.moveDown()
      doc.fontSize(10).text(`生成时间: ${new Date().toLocaleString()}`, { align: 'right' })
      doc.text(`设备序列号: ${errorLog.deviceSerial}`, { align: 'right' })
      doc.moveDown()

      // Error Info
      doc.fontSize(14).fillColor('#f7768e').text('检测到的错误日志:')
      doc.fontSize(10).fillColor('black').text(`${errorLog.timestamp} ${errorLog.level}/${errorLog.tag}: ${errorLog.message}`, {
        indent: 20
      })
      doc.moveDown()

      // AI Analysis
      doc.fontSize(14).fillColor('#7aa2f7').text('AI 诊断结果:')
      doc.fontSize(11).fillColor('black').text(analysis, {
        align: 'justify',
        lineGap: 2
      })
      doc.moveDown()

      // Context Logs
      doc.fontSize(14).fillColor('#9ece6a').text('相关上下文日志 (前后 50 行):')
      doc.moveDown()
      doc.fontSize(8).fillColor('#565f89')
      
      contextLogs.forEach(log => {
        const line = `${log.timestamp} ${log.level}/${log.tag}(${log.pid}): ${log.message}`
        doc.text(line, { lineBreak: true })
      })

      doc.end()

      stream.on('finish', () => resolve())
      stream.on('error', (err) => reject(err))
    })
  }
}
