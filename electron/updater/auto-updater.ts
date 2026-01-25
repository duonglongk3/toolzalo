import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow, ipcMain, dialog } from 'electron'
import log from 'electron-log'

// Configure logging
autoUpdater.logger = log
;(autoUpdater.logger as any).transports.file.level = 'info'

// Disable auto download - we want user to confirm first
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

let mainWindow: BrowserWindow | null = null

export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window

  // Check for updates on startup (after 3 seconds delay)
  setTimeout(() => {
    checkForUpdates(false)
  }, 3000)

  // Set up event handlers
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...')
    sendStatusToWindow('checking-for-update')
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('Update available:', info.version)
    sendStatusToWindow('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info('Update not available. Current version is latest:', info.version)
    sendStatusToWindow('update-not-available', {
      version: info.version
    })
  })

  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater:', err)
    sendStatusToWindow('update-error', {
      error: err?.message || String(err)
    })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `Download speed: ${formatBytes(progressObj.bytesPerSecond)}/s - Downloaded ${progressObj.percent.toFixed(1)}% (${formatBytes(progressObj.transferred)}/${formatBytes(progressObj.total)})`
    log.info(logMessage)
    sendStatusToWindow('download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info('Update downloaded:', info.version)
    sendStatusToWindow('update-downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes
    })
  })
}

function sendStatusToWindow(status: string, data?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater-status', { status, data })
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function checkForUpdates(showNoUpdateDialog = true) {
  autoUpdater.checkForUpdates().catch((err) => {
    log.error('Check for updates failed:', err)
    if (showNoUpdateDialog && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Lỗi kiểm tra cập nhật',
        message: 'Không thể kiểm tra cập nhật. Vui lòng kiểm tra kết nối mạng.',
        detail: err?.message || String(err)
      })
    }
  })
}

export function downloadUpdate() {
  autoUpdater.downloadUpdate().catch((err) => {
    log.error('Download update failed:', err)
    sendStatusToWindow('update-error', {
      error: err?.message || String(err)
    })
  })
}

export function installUpdate() {
  autoUpdater.quitAndInstall(false, true)
}

// IPC handlers
export function registerUpdaterIPC() {
  ipcMain.handle('updater-check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, updateInfo: result?.updateInfo }
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) }
    }
  })

  ipcMain.handle('updater-download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) }
    }
  })

  ipcMain.handle('updater-install', () => {
    autoUpdater.quitAndInstall(false, true)
    return { success: true }
  })

  ipcMain.handle('updater-get-version', () => {
    const { app } = require('electron')
    return app.getVersion()
  })
}
