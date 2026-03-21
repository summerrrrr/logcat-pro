import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export function detectAdbPath(): string | null {
  // 0. Priority: Check bundled ADB in resources
  const isPackaged = app.isPackaged
  const appPath = isPackaged 
    ? process.resourcesPath 
    : join(app.getAppPath(), 'resources')

  const bundledAdbPath = process.platform === 'win32'
    ? join(appPath, 'bin', 'adb', 'adb.exe')
    : join(appPath, 'bin', 'adb', 'adb')

  if (existsSync(bundledAdbPath)) {
    console.log('[ADB] Using bundled ADB at:', bundledAdbPath)
    return bundledAdbPath
  }

  // 1. Try PATH (which adb / where adb)
  try {
    const result = execSync('where adb', { encoding: 'utf-8', timeout: 5000 }).trim()
    if (result) return result.split('\n')[0].trim()
  } catch {}

  // 2. Check ANDROID_HOME / ANDROID_SDK_ROOT
  const sdkPaths = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
  ].filter(Boolean)

  for (const sdk of sdkPaths) {
    const adbPath = join(sdk!, 'platform-tools', 'adb.exe')
    if (existsSync(adbPath)) return adbPath
  }

  // 3. Common Windows paths
  const home = process.env.USERPROFILE || ''
  const commonPaths = [
    join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    'C:\\Android\\sdk\\platform-tools\\adb.exe',
  ]
  for (const p of commonPaths) {
    if (existsSync(p)) return p
  }

  return null
}
