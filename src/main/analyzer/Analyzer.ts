import { LogEntry, Issue } from '../../shared/types'
import { AnalysisRule } from './rules/CrashRule'
import { CrashRule } from './rules/CrashRule'
import { AnrRule } from './rules/AnrRule'
import { PerformanceRule } from './rules/PerformanceRule'

export class Analyzer {
  private rules: AnalysisRule[] = []

  constructor() {
    this.rules = [new CrashRule(), new AnrRule(), new PerformanceRule()]
  }

  analyze(logs: LogEntry[]): Issue[] {
    const issues: Issue[] = []
    for (const rule of this.rules) {
      issues.push(...rule.analyze(logs))
    }
    return issues.sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  }

  addRule(rule: AnalysisRule): void {
    this.rules.push(rule)
  }

  getRules(): string[] {
    return this.rules.map(r => r.name)
  }
}
