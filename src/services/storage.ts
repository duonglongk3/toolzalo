// Storage service for Electron app using electron-store
class StorageService {
  private isElectron: boolean

  constructor() {
    this.isElectron = typeof window !== 'undefined' && window.electronAPI
  }

  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      if (this.isElectron) {
        const value = await window.electronAPI.store.get(key)
        return value !== undefined ? value : defaultValue
      } else {
        // Fallback to localStorage for web version
        const item = localStorage.getItem(key)
        return item ? JSON.parse(item) : defaultValue
      }
    } catch (error) {
      console.error('Storage get error:', error)
      return defaultValue
    }
  }

  async set<T>(key: string, value: T): Promise<boolean> {
    try {
      if (this.isElectron) {
        return await window.electronAPI.store.set(key, value)
      } else {
        localStorage.setItem(key, JSON.stringify(value))
        return true
      }
    } catch (error) {
      console.error('Storage set error:', error)
      return false
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      if (this.isElectron) {
        return await window.electronAPI.store.delete(key)
      } else {
        localStorage.removeItem(key)
        return true
      }
    } catch (error) {
      console.error('Storage delete error:', error)
      return false
    }
  }

  async clear(): Promise<boolean> {
    try {
      if (this.isElectron) {
        return await window.electronAPI.store.clear()
      } else {
        localStorage.clear()
        return true
      }
    } catch (error) {
      console.error('Storage clear error:', error)
      return false
    }
  }

  // Backup and restore functionality
  async backup(): Promise<string | null> {
    try {
      if (this.isElectron) {
        // Get all data from electron store
        const data = {
          accounts: await this.get('zalo-accounts'),
          friends: await this.get('zalo-friends'),
          groups: await this.get('zalo-groups'),
          templates: await this.get('zalo-templates'),
          config: await this.get('zalo-app'),
          exportedAt: new Date().toISOString(),
          version: '1.0.0'
        }
        return JSON.stringify(data, null, 2)
      }
      return null
    } catch (error) {
      console.error('Backup error:', error)
      return null
    }
  }

  async restore(backupData: string): Promise<boolean> {
    try {
      const data = JSON.parse(backupData)
      
      // Validate backup data structure
      if (!data.version || !data.exportedAt) {
        throw new Error('Invalid backup format')
      }

      // Restore each data type
      if (data.accounts) await this.set('zalo-accounts', data.accounts)
      if (data.friends) await this.set('zalo-friends', data.friends)
      if (data.groups) await this.set('zalo-groups', data.groups)
      if (data.templates) await this.set('zalo-templates', data.templates)
      if (data.config) await this.set('zalo-app', data.config)

      return true
    } catch (error) {
      console.error('Restore error:', error)
      return false
    }
  }

  // Export data to file
  async exportToFile(): Promise<void> {
    try {
      const backupData = await this.backup()
      if (!backupData) {
        throw new Error('Failed to create backup')
      }

      if (this.isElectron) {
        const result = await window.electronAPI.dialog.showSaveDialog({
          title: 'Export Zalo Manager Data',
          defaultPath: `zalo-manager-backup-${new Date().toISOString().split('T')[0]}.json`,
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (!result.canceled && result.filePath) {
          // In a real implementation, you'd write the file using Node.js fs
          // For now, we'll use the download approach
          this.downloadFile(backupData, `zalo-manager-backup-${new Date().toISOString().split('T')[0]}.json`)
        }
      } else {
        this.downloadFile(backupData, `zalo-manager-backup-${new Date().toISOString().split('T')[0]}.json`)
      }
    } catch (error) {
      console.error('Export error:', error)
      throw error
    }
  }

  // Import data from file
  async importFromFile(): Promise<boolean> {
    try {
      if (this.isElectron) {
        const result = await window.electronAPI.dialog.showOpenDialog({
          title: 'Import Zalo Manager Data',
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile']
        })

        if (!result.canceled && result.filePaths.length > 0) {
          // In a real implementation, you'd read the file using Node.js fs
          // For now, we'll return false to indicate manual file selection needed
          return false
        }
      }
      
      // For web version or manual file selection
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) {
            try {
              const text = await file.text()
              const success = await this.restore(text)
              resolve(success)
            } catch (error) {
              console.error('Import file error:', error)
              resolve(false)
            }
          } else {
            resolve(false)
          }
        }
        input.click()
      })
    } catch (error) {
      console.error('Import error:', error)
      return false
    }
  }

  private downloadFile(data: string, filename: string): void {
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

export const storageService = new StorageService()
