import { LogEntry, LogLevel } from '../../shared/types'

// Parse logcat -v threadtime format:
// "MM-DD HH:MM:SS.mmm  PID  TID LEVEL TAG: MESSAGE"
const LOGCAT_REGEX = /^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.+?)\s*:\s+([\s\S]*)/

let nextId = 1

export function parseLogLine(line: string, deviceSerial: string): LogEntry | null {
  const match = line.match(LOGCAT_REGEX)
  if (!match) return null

  const [, date, time, pid, tid, level, tag, message] = match
  const year = new Date().getFullYear()

  return {
    id: nextId++,
    timestamp: `${year}-${date} ${time}`,
    pid: parseInt(pid),
    tid: parseInt(tid),
    level: level as LogLevel,
    tag: tag.trim(),
    message: message,
    deviceSerial,
    raw: line
  }
}

export function resetIdCounter(): void {
  nextId = 1
}
