import { LogEntry, Issue } from '../../../shared/types'
import { AnalysisRule } from './CrashRule'

export class PerformanceRule implements AnalysisRule {
  name = 'Performance Detection'

  analyze(logs: LogEntry[]): Issue[] {
    const issues: Issue[] = []
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i]
      const issue = this.checkSkippedFrames(log)
        || this.checkGC(log)
        || this.checkSlowOperation(log)
      if (issue) issues.push(issue)
    }
    return issues
  }

  private checkSkippedFrames(log: LogEntry): Issue | null {
    const match = log.message.match(/Choreographer.*Skipped (\d+) frames/)
    if (!match) return null

    const frames = parseInt(match[1])
    if (frames <= 10) return null

    const severity = frames > 30 ? 'warning' as const : 'info' as const
    return {
      id: `perf-frames-${log.id}`,
      type: 'performance',
      severity,
      title: `Skipped ${frames} frames`,
      description: log.raw,
      logIds: [log.id],
      timestamp: log.timestamp,
      deviceSerial: log.deviceSerial
    }
  }

  private checkGC(log: LogEntry): Issue | null {
    if (!/GC_|Background GC/.test(log.message) && !/GC_|Background GC/.test(log.tag)) {
      return null
    }
    return {
      id: `perf-gc-${log.id}`,
      type: 'performance',
      severity: 'info',
      title: `GC event: ${log.message.substring(0, 80)}`,
      description: log.raw,
      logIds: [log.id],
      timestamp: log.timestamp,
      deviceSerial: log.deviceSerial
    }
  }

  private checkSlowOperation(log: LogEntry): Issue | null {
    if (!/Slow operation/.test(log.message)) return null
    return {
      id: `perf-slow-${log.id}`,
      type: 'performance',
      severity: 'warning',
      title: `Slow operation: ${log.message.substring(0, 80)}`,
      description: log.raw,
      logIds: [log.id],
      timestamp: log.timestamp,
      deviceSerial: log.deviceSerial
    }
  }
}
