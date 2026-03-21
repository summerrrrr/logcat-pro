import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Device } from '../../shared/types'

export const useDeviceStore = defineStore('device', () => {
  const devices = ref<Device[]>([])
  const activeDevice = ref<string | null>(null)
  const activePid = ref<number | null>(null)
  const isWatching = ref(false)
  const isPaused = ref(false)
  
  const performanceData = ref<{ cpu: number[], memory: number[], timestamps: string[] }>({
    cpu: [],
    memory: [],
    timestamps: []
  })
  let perfInterval: any = null

  let unbindConnected: (() => void) | null = null
  let unbindDisconnected: (() => void) | null = null

  async function fetchDevices() {
    devices.value = await window.electronAPI.device.list()
    if (!activeDevice.value && devices.value.length > 0) {
      activeDevice.value = devices.value[0].serial
    }
  }

  function startWatching() {
    if (isWatching.value) return // Avoid multiple watchers
    
    window.electronAPI.device.watchStart()
    isWatching.value = true

    unbindConnected = window.electronAPI.device.onConnected(async () => {
      await fetchDevices()
    })

    unbindDisconnected = window.electronAPI.device.onDisconnected(async (device: any) => {
      await fetchDevices()
      if (activeDevice.value === device.serial) {
        activeDevice.value = devices.value.length > 0 ? devices.value[0].serial : null
      }
    })
  }

  function stopWatching() {
    window.electronAPI.device.watchStop()
    if (unbindConnected) unbindConnected()
    if (unbindDisconnected) unbindDisconnected()
    unbindConnected = null
    unbindDisconnected = null
    isWatching.value = false
  }

  function startPerformancePolling() {
    if (perfInterval || !activeDevice.value || !activePid.value) return
    isPaused.value = false
    
    perfInterval = setInterval(async () => {
      if (!activeDevice.value || !activePid.value) {
        stopPerformancePolling()
        return
      }

      if (isPaused.value) return

      try {
        const data = await window.electronAPI.device.getPerformance(
          activeDevice.value, 
          activePid.value
        )
        
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        performanceData.value.timestamps.push(now)
        performanceData.value.cpu.push(data.cpu)
        performanceData.value.memory.push(data.memory)

        if (performanceData.value.timestamps.length > 30) {
          performanceData.value.timestamps.shift()
          performanceData.value.cpu.shift()
          performanceData.value.memory.shift()
        }
      } catch (e) {
        console.error('Failed to poll performance:', e)
      }
    }, 2000)
  }

  function stopPerformancePolling() {
    if (perfInterval) {
      clearInterval(perfInterval)
      perfInterval = null
    }
    isPaused.value = false
  }

  function togglePause() {
    isPaused.value = !isPaused.value
  }

  function clearPerformanceData() {
    performanceData.value = { cpu: [], memory: [], timestamps: [] }
  }

  function setActiveDevice(serial: string | null) {
    activeDevice.value = serial
    activePid.value = null
    stopPerformancePolling()
  }

  function setActivePid(pid: number | null) {
    activePid.value = pid
    clearPerformanceData()
    if (pid) {
      startPerformancePolling()
    } else {
      stopPerformancePolling()
    }
  }

  async function connectWifi(ip: string, port: number) {
    const result = await window.electronAPI.device.connectWifi(ip, port)
    await fetchDevices()
    return result
  }

  return {
    devices,
    activeDevice,
    activePid,
    isWatching,
    isPaused,
    performanceData,
    fetchDevices,
    startWatching,
    stopWatching,
    setActiveDevice,
    setActivePid,
    connectWifi,
    startPerformancePolling,
    stopPerformancePolling,
    togglePause,
    clearPerformanceData
  }
})
