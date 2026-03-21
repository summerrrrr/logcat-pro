import { LogEntry, Issue } from '../../../shared/types'
import { AnalysisRule } from './CrashRule'

export class AnrRule implements AnalysisRule {
  name = 'ANR Detection'

  private patterns: { regex: RegExp; extract?: boolean }[] = [
    { regex: /ANR in (\S+)/, extract: true },
    { regex: /Input dispatching timed out/ },
    { regex: /Reason: (.+)/, extract: true },
  ]

  analyze(logs: LogEntry[]): Issue[] {
    const issues: Issue[] = []
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i]
      if (log.level !== 'E' && log.level !== 'W') continue

      for (const { regex } of this.patterns) {
        const match = log.message.match(regex) || log.tag.match(regex)
        if (match) {
          const relatedIds = this.collectRelated(logs, i, log.pid)
          const appName = match[1] || 'Unknown'
          issues.push({
            id: `anr-${log.id}`,
            type: 'anr',
            severity: 'critical',
            title: `ANR: ${appName} - ${log.message.substring(0, 80)}`,
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
