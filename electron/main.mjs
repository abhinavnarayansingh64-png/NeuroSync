import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectHardwareProfile } from './nativeTelemetry.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hostedAppUrl = process.env.NEUROSYNC_DESKTOP_URL || 'https://neurosync-beikmn85.manus.space'

function desktopUrl() {
  const target = new URL(hostedAppUrl)
  target.pathname = '/desktop'
  target.search = ''
  return target.toString()
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#090909',
    title: 'NeuroSync Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  window.loadURL(desktopUrl())
}

app.whenReady().then(() => {
  ipcMain.handle('neurosync:hardware-profile', () => collectHardwareProfile())
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
