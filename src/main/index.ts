import { app, BrowserWindow, shell, Menu, ipcMain } from 'electron'
import { join } from 'path'
import { setupIpc, disposeIpc } from './ipc'
import { closeDatabase } from './storage/Database'

export function createScreenshotWindow(screenshotData: string, serial: string, parent?: BrowserWindow): BrowserWindow {
  const win = new BrowserWindow({
    width: 450,
    height: 800,
    title: `Screenshot - ${serial}`,
    frame: false,
    titleBarStyle: 'hidden',
    parent: parent,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const isDev = !app.isPackaged
  const baseUrl = isDev && process.env['ELECTRON_RENDERER_URL'] 
    ? process.env['ELECTRON_RENDERER_URL'] 
    : `file://${join(__dirname, '../renderer/index.html')}`
  
  const url = `${baseUrl}#screenshot?data=${encodeURIComponent(screenshotData)}&serial=${serial}`
  win.loadURL(url)
  
  win.on('ready-to-show', () => {
    win.show()
  })

  return win
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    title: 'LogCat Pro',
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
  
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized-change', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized-change', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 开发模式下启用开发者工具快捷键
  if (isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        mainWindow.webContents.toggleDevTools()
        event.preventDefault()
      }
      // F12 快捷键
      if (input.key === 'F12') {
        mainWindow.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  }

  return mainWindow
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  const mainWindow = createWindow()
  setupIpc(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  disposeIpc()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
