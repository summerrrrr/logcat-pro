import { LogEntry, Issue } from '../../../shared/types'

export interface AnalysisRule {
  name: string
  analyze(logs: LogEntry[]): Issue[]
}

export class CrashRule implements AnalysisRule {
  name = 'Crash Detection'

  private patterns = [
    /FATAL EXCEPTION/,
    /java\.lang\.\w+Exception/,
    /java\.lang\.\w+Error/,
    /signal \d+ \(SIG\w+\)/,
    /CRASH/i,
    /Native crash/,
  ]

  analyze(logs: LogEntry[]): Issue[] {
    const issues: Issue[] = []
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i]
      if (log.level !== 'E' && log.level !== 'F') continue

      for (const pattern of this.patterns) {
        if (pattern.test(log.message) || pattern.test(log.tag)) {
          const relatedIds = this.collectRelated(logs, i, log.pid)
          issues.push({
            id: `crash-${log.id}`,
            type: 'crash',
            severity: 'critical',
            title: `Crash: ${log.message.substring(0, 100)}`,
            description: log.raw,
            logIds: relatedIds,
            timestamp: log.timestamp,
            deviceSerial: log.deviceSerial
          })
          break
        }
      }
    }
    return issues
  }

  private collectRelated(logs: LogEntry[], index: number, pid: number): number[] {
    const ids: number[] = []
    const start = Math.max(0, index - 5)
    const end = Math.min(logs.length, index + 50)
    for (let i = start; i < end; i++) {
      if (logs[i].pid === pid) ids.push(logs[i].id)
    }
    return ids
  }
}
