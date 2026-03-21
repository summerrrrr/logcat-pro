import { EventEmitter } from 'events'
import { execSync, exec, spawn } from 'child_process'
import { join } from 'path'
import { Device, ProcessInfo } from '../../shared/types'
import { detectAdbPath } from './AdbPath'

export class AdbManager extends EventEmitter {
  private adbPath: string | null = null
  private watchInterval: ReturnType<typeof setInterval> | null = null
  private previousDevices: Map<string, Device> = new Map()

  constructor() {
    super()
    this.adbPath = detectAdbPath()
  }

  getAdbPath(): string | null {
    return this.adbPath
  }

  listDevices(): Device[] {
    if (!this.adbPath) return []

    try {
      const output = execSync(`"${this.adbPath}" devices -l`, {
        encoding: 'utf-8',
        timeout: 10000,
      })

      const devices: Device[] = []
      const lines = output.split('\n').slice(1) // skip header

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === '') continue

        const parts = trimmed.split(/\s+/)
        const serial = parts[0]
        const state = parts[1]
        if (state !== 'device') continue

        const props = trimmed.substring(serial.length + state.length + 2)
        const model = this.extractProp(props, 'model') || serial
        const product = this.extractProp(props, 'product') || ''
        const transportId = this.extractProp(props, 'transport_id') || ''
        const isWifi = serial.includes(':')

        devices.push({
          serial,
          model: model.replace(/_/g, ' '),
          product,
          type: isWifi ? 'wifi' : 'usb',
          androidVersion: '',
          status: 'device',
        })
      }

      return devices
    } catch {
      return []
    }
  }

  watchDevices(): void {
    if (this.watchInterval) return

    this.previousDevices = new Map(
      this.listDevices().map(d => [d.serial, d])
    )

    this.watchInterval = setInterval(() => {
      const current = this.listDevices()
      const currentMap = new Map(current.map(d => [d.serial, d]))

      // Check for new devices
      for (const [serial, device] of currentMap) {
        if (!this.previousDevices.has(serial)) {
          this.emit('device-connected', device)
        }
      }

      // Check for removed devices
      for (const [serial, device] of this.previousDevices) {
        if (!currentMap.has(serial)) {
          this.emit('device-disconnected', device)
        }
      }

      this.previousDevices = currentMap
    }, 2000)
  }

  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval)
      this.watchInterval = null
    }
  }

  connectWifi(ip: string, port: number = 5555): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.adbPath) return reject(new Error('ADB not found'))
      exec(
        `"${this.adbPath}" connect ${ip}:${port}`,
        { encoding: 'utf-8', timeout: 10000 },
        (error, stdout, stderr) => {
          if (error) return reject(new Error(stderr || error.message))
          resolve(stdout.trim())
        }
      )
    })
  }

  disconnectAll(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.adbPath) return reject(new Error('ADB not found'))
      exec(
        `"${this.adbPath}" disconnect`,
        { encoding: 'utf-8', timeout: 10000 },
        (error, stdout, stderr) => {
          if (error) return reject(new Error(stderr || error.message))
          resolve(stdout.trim())
        }
      )
    })
  }

  reboot(serial: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.adbPath) return reject(new Error('ADB not found'))
      exec(`"${this.adbPath}" -s ${serial} reboot`, (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || error.message))
        resolve()
      })
    })
  }

  shutdown(serial: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.adbPath) return reject(new Error('ADB not found'))
      // Some devices may not support 'reboot -p', fallback to power button long press or other methods is complex.
      // Standard way for many is 'reboot -p'
      exec(`"${this.adbPath}" -s ${serial} shell reboot -p`, (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || error.message))
        resolve()
      })
    })
  }

  takeScreenshot(serial: string): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      if (!this.adbPath) return reject(new Error('ADB not found'))

      // Robust strategy for Windows: save to temp file on device, then pull
      // This is exactly how Android Studio and other high-quality tools do it 
      // to avoid stdout corruption.
      const deviceTempPath = `/data/local/tmp/screenshot_${Date.now()}.png`
      const localTempPath = join(require('os').tmpdir(), `logcat_pro_screenshot_${Date.now()}.png`)

      try {
        // 1. Cap to device file
        await new Promise<void>((res, rej) => {
          exec(`"${this.adbPath}" -s ${serial} shell screencap -p ${deviceTempPath}`, (err, stdout, stderr) => {
            if (err) return rej(new Error(stderr.toString() || err.message))
            res()
          })
        })

        // 2. Pull from device
        await new Promise<void>((res, rej) => {
          exec(`"${this.adbPath}" -s ${serial} pull ${deviceTempPath} "${localTempPath}"`, (err, stdout, stderr) => {
            if (err) return rej(new Error(stderr.toString() || err.message))
            res()
          })
        })

        // 3. Read local file
        const buffer = require('fs').readFileSync(localTempPath)
        
        // 4. Cleanup (async, don't wait for it)
        exec(`"${this.adbPath}" -s ${serial} shell rm ${deviceTempPath}`)
        require('fs').unlink(localTempPath, () => {})

        resolve(buffer)
      } catch (e) {
        reject(e)
      }
    })
  }

  getDeviceInfo(serial: string): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      if (!this.adbPath) return reject(new Error('ADB not found'))
      exec(
        `"${this.adbPath}" -s ${serial} shell getprop`,
        { encoding: 'utf-8', timeout: 10000 },
        (error, stdout, stderr) => {
          if (error) return reject(new Error(stderr || error.message))
          const info: Record<string, string> = {}
          const lines = stdout.split('\n')
          for (const line of lines) {
            const match = line.match(/\[(.+?)\]:\s*\[(.+?)\]/)
            if (match) info[match[1]] = match[2]
          }
          resolve(info)
        }
      )
    })
  }

  dispose(): void {
    this.stopWatching()
    this.removeAllListeners()
  }

  listProcesses(serial: string): Promise<ProcessInfo[]> {
    return new Promise((resolve, reject) => {
      if (!this.adbPath) return reject(new Error('ADB not found'))
      exec(
        `"${this.adbPath}" -s ${serial} shell ps -A -o PID,NAME`,
        { encoding: 'utf-8', timeout: 10000 },
        (error, stdout, stderr) => {
          if (error) return reject(new Error(stderr || error.message))
          const processes: ProcessInfo[] = []
          const lines = stdout.split('\n').slice(1) // skip header
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            const parts = trimmed.split(/\s+/, 2)
            const pid = parseInt(parts[0], 10)
            const name = parts[1]
            if (!isNaN(pid) && name) {
              processes.push({ pid, name })
            }
          }
          // Sort logic: 
          // 1. com.iflyrec or com.iflytek first
          // 2. other apps (contain '.') second
          // 3. system processes last
          processes.sort((a, b) => {
            const isIflyA = a.name.startsWith('com.iflyrec') || a.name.startsWith('com.iflytek')
            const isIflyB = b.name.startsWith('com.iflyrec') || b.name.startsWith('com.iflytek')
            
            if (isIflyA && !isIflyB) return -1
            if (!isIflyA && isIflyB) return 1
            
            const aIsApp = a.name.includes('.')
            const bIsApp = b.name.includes('.')
            if (aIsApp !== bIsApp) return aIsApp ? -1 : 1
            
            return a.name.localeCompare(b.name)
          })
          resolve(processes)
        }
      )
    })
  }

  private coreCount: number = 0

  private async getCoreCount(serial: string): Promise<number> {
    if (this.coreCount > 0) return this.coreCount
    return new Promise((resolve) => {
      exec(`"${this.adbPath}" -s ${serial} shell "nproc || grep -c ^processor /proc/cpuinfo"`, (err, stdout) => {
        this.coreCount = (!err && stdout) ? parseInt(stdout.trim(), 10) || 8 : 8
        resolve(this.coreCount)
      })
    })
  }

  getProcessPerformance(serial: string, pid: number): Promise<{ cpu: number, memory: number }> {
    return new Promise(async (resolve) => {
      if (!this.adbPath) return resolve({ cpu: 0, memory: 0 })
      
      const cores = await this.getCoreCount(serial)
      let cpu = 0
      
      // Strategy 1: 'top' Batch Mode (Best for real-time responsiveness)
      // We look for the %CPU column specifically
      exec(`"${this.adbPath}" -s ${serial} shell "top -n 1 -b -p ${pid}"`, { encoding: 'utf-8', timeout: 4000 }, (err, stdout) => {
        if (!err && stdout) {
          const lines = stdout.split('\n')
          for (const line of lines) {
            if (line.includes(` ${pid} `)) {
              const parts = line.trim().split(/\s+/)
              // Heuristic: CPU is usually index 8-10. Let's find the first float that isn't PID.
              const val = parts.slice(1).find(p => p.includes('.') && parseFloat(p) < 1000)
              if (val) {
                cpu = parseFloat(val)
                // If top already normalized it (common in newer Android), cpu will be < 100
                // If it's cumulative (common in some busybox top), we divide by cores
                if (cpu > 100) cpu = cpu / cores
                console.log(`[AdbManager] Top CPU: ${cpu}% (Raw: ${val}, Cores: ${cores})`)
              }
              break
            }
          }
        }

        // Strategy 2: Fallback to dumpsys cpuinfo if top is 0 or failed
        if (cpu === 0) {
          exec(`"${this.adbPath}" -s ${serial} shell dumpsys cpuinfo`, { encoding: 'utf-8', timeout: 5000 }, (errD, stdoutD) => {
            if (!errD && stdoutD) {
              const dLines = stdoutD.split('\n')
              for (const dLine of dLines) {
                if (dLine.includes(`${pid}/`)) {
                  const match = dLine.match(/(\d+\.?\d*)%/)
                  if (match) {
                    cpu = parseFloat(match[1]) / cores
                    console.log(`[AdbManager] Dumpsys CPU: ${cpu}% (Normalized by ${cores} cores)`)
                    break
                  }
                }
              }
            }
            this.finishPerfResult(serial, pid, cpu, resolve)
          })
        } else {
          this.finishPerfResult(serial, pid, cpu, resolve)
        }
      })
    })
  }

  private async finishPerfResult(serial: string, pid: number, cpu: number, resolve: (val: any) => void) {
    const memory = await this.getMemoryInfo(serial, pid)
    console.log(`[AdbManager] Final Stats for ${pid} -> CPU: ${cpu}%, MEM: ${memory}MB`)
    resolve({ cpu, memory })
  }

  private getMemoryInfo(serial: string, pid: number): Promise<number> {
    return new Promise((resolve) => {
      if (!this.adbPath) return resolve(0)
      exec(`"${this.adbPath}" -s ${serial} shell dumpsys meminfo ${pid}`, { encoding: 'utf-8', timeout: 5000 }, (err, stdout) => {
        if (!err && stdout) {
          const match = stdout.match(/TOTAL\s+PSS:\s+(\d+)/i) || 
                        stdout.match(/TOTAL:\s+(\d+)/i) ||
                        stdout.match(/\s+TOTAL\s+(\d+)/)
          
          if (match && match[1]) {
            const mem = parseInt(match[1], 10) / 1024
            return resolve(mem)
          }
        }
        console.warn(`[AdbManager] Could not parse memory for PID ${pid}`)
        resolve(0)
      })
    })
  }

  listDirectory(serial: string, path: string): Promise<{ name: string, isDir: boolean, size: number, date: string }[]> {
    return new Promise((resolve, reject) => {
      if (!this.adbPath) return reject(new Error('ADB not found'))
      // Use ls -l to get details
      exec(`"${this.adbPath}" -s ${serial} shell ls -l "${path}"`, { encoding: 'utf-8', timeout: 10000 }, (error, stdout) => {
        if (error) {
          // If permission denied or not a directory, resolve empty or throw
          return resolve([]) 
        }
        
        const files: { name: string, isDir: boolean, size: number, date: string }[] = []
        const lines = stdout.split('\n')
        
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('total ')) continue
          
          // drwxrwx--- 2 root root 4096 2023-10-01 12:00 myfolder
          const parts = trimmed.split(/\s+/)
          if (parts.length >= 6) {
            const permissions = parts[0]
            const isDir = permissions.startsWith('d') || permissions.startsWith('l')
            
            // Heuristic to extract name: join everything after the time/year
            // Different Android versions have different ls output formats
            let nameIdx = parts.length - 1
            for (let i = 3; i < parts.length; i++) {
               if (parts[i].includes(':') || (parts[i].length === 4 && parseInt(parts[i]) > 1990)) {
                   nameIdx = i + 1
                   break
               }
            }
            
            const name = parts.slice(nameIdx).join(' ')
            if (name === '.' || name === '..') continue

            const size = parseInt(parts[nameIdx - 2]) || 0
            const date = parts.slice(nameIdx - 2, nameIdx).join(' ') // roughly date time

            files.push({ name, isDir, size, date })
          }
        }
        
        // Sort: dirs first, then alphabetical
        files.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1
          if (!a.isDir && b.isDir) return 1
          return a.name.localeCompare(b.name)
        })
        
        resolve(files)
      })
    })
  }

  readFile(serial: string, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.adbPath) return reject(new Error('ADB not found'))
      
      // We use cat. NOTE: this only works well for text files and files we have permission to read.
      exec(`"${this.adbPath}" -s ${serial} shell cat "${path}"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(stderr || error.message))
        }
        resolve(stdout)
      })
    })
  }

  private extractProp(str: string, key: string): string | null {
    const match = str.match(new RegExp(`${key}:(\\S+)`))
    return match ? match[1] : null
  }
}
