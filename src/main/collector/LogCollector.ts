import { EventEmitter } from 'events'
import { ChildProcess, spawn } from 'child_process'
import { createInterface } from 'readline'
import { LogEntry, CollectorOptions } from '../../shared/types'
import { parseLogLine } from './LogParser'
import { detectAdbPath } from '../adb/AdbPath'

export class LogCollector extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map()
  private buffers: Map<string, LogEntry[]> = new Map()
  private paused: Set<string> = new Set()
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map()
  private adbPath: string | null

  constructor() {
    super()
    this.adbPath = detectAdbPath()
  }

  start(serial: string, options?: CollectorOptions): void {
    if (!this.adbPath) {
      this.emit('error', serial, new Error('ADB not found'))
      return
    }

    if (this.processes.has(serial)) {
      this.stop(serial)
    }

    const args = ['-s', serial, 'logcat', '-v', 'threadtime']
    if (options?.filter) {
      args.push(options.filter)
    } else {
      args.push('*:V')
    }

    const proc = spawn(this.adbPath, args)
    this.processes.set(serial, proc)
    this.buffers.set(serial, [])

    const rl = createInterface({ input: proc.stdout! })
    rl.on('line', (line: string) => {
      const entry = parseLogLine(line, serial)
      if (!entry) return

      const buffer = this.buffers.get(serial)
      if (!buffer) return
      buffer.push(entry)

      if (buffer.length >= 100) {
        this.flushBuffer(serial)
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      this.emit('error', serial, new Error(data.toString()))
    })

    proc.on('close', (code: number | null) => {
      this.cleanup(serial)
      this.emit('close', serial, code)
    })

    proc.on('error', (err: Error) => {
      this.cleanup(serial)
      this.emit('error', serial, err)
    })

    // Flush timer: every 100ms
    const timer = setInterval(() => {
      this.flushBuffer(serial)
    }, 100)
    this.timers.set(serial, timer)

    this.emit('started', serial)
  }

  stop(serial: string): void {
    const proc = this.processes.get(serial)
    if (proc) {
      proc.kill()
    }
    this.cleanup(serial)
  }

  pause(serial: string): void {
    this.paused.add(serial)
  }

  resume(serial: string): void {
    this.paused.delete(serial)
    this.flushBuffer(serial)
  }

  stopAll(): void {
    for (const serial of this.processes.keys()) {
      this.stop(serial)
    }
  }

  isRunning(serial: string): boolean {
    return this.processes.has(serial)
  }

  isPaused(serial: string): boolean {
    return this.paused.has(serial)
  }

  private flushBuffer(serial: string): void {
    if (this.paused.has(serial)) return

    const buffer = this.buffers.get(serial)
    if (!buffer || buffer.length === 0) return

    const logs = buffer.splice(0, buffer.length)
    this.emit('logs', serial, logs)
  }

  private cleanup(serial: string): void {
    const timer = this.timers.get(serial)
    if (timer) clearInterval(timer)
    this.timers.delete(serial)
    this.processes.delete(serial)
    this.buffers.delete(serial)
    this.paused.delete(serial)
  }
}
