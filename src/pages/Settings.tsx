import React from 'react'
import { Settings as SettingsIcon, Moon, Sun, Monitor, Globe, Bell, Shield, Database, Download, Upload, RotateCcw, Key, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Modal, Input } from '@/components/ui'
import { useAppStore } from '@/store'
import { useLicense } from '@/contexts/LicenseContext'
import { useI18n } from '@/i18n'
import toast from 'react-hot-toast'

const Settings: React.FC = () => {
  const { config, updateConfig } = useAppStore()
  const { isLicenseValid, licenseInfo, clearLicense, hwid } = useLicense()
  const { t } = useI18n()
  const [showBackupModal, setShowBackupModal] = React.useState(false)
  const [showRestoreModal, setShowRestoreModal] = React.useState(false)
  const [backupData, setBackupData] = React.useState('')

  const electronAPI: any = (typeof window !== 'undefined' && (window as any).electronAPI) || null
  const [versions, setVersions] = React.useState<{ electron?: string; node?: string; chrome?: string } | null>(null)
  const [appVersion, setAppVersion] = React.useState<string>('N/A')

  React.useEffect(() => {
    try {
      const v = electronAPI?.node?.process?.versions
      if (v) setVersions(v)
    } catch {}
    try {
      electronAPI?.app?.getVersion?.().then((v: string) => v && setAppVersion(v)).catch(() => {})
    } catch {}
  }, [])

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateConfig({ theme })
    toast.success(t('settings.themeUpdated'))
  }

  const handleLanguageChange = (language: 'vi' | 'en') => {
    updateConfig({ language })
    toast.success(t('settings.languageUpdated'))
  }

  const handleExportData = () => {
    try {
      // Get all data from localStorage
      const data = {
        accounts: JSON.parse(localStorage.getItem('zalo-accounts') || '{}'),
        friends: JSON.parse(localStorage.getItem('zalo-friends') || '{}'),
        groups: JSON.parse(localStorage.getItem('zalo-groups') || '{}'),
        templates: JSON.parse(localStorage.getItem('zalo-templates') || '{}'),
        config: JSON.parse(localStorage.getItem('zalo-app') || '{}'),
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      }

      const jsonContent = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `zalo_manager_backup_${new Date().toISOString().split('T')[0]}.json`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success(t('settings.exportSuccess'))
    } catch (error) {
      console.error('Export data error:', error)
      toast.error(t('settings.exportFailed'))
    }
  }

  const handleImportData = () => {
    if (!backupData.trim()) {
      toast.error(t('settings.pasteBackupData'))
      return
    }

    try {
      const data = JSON.parse(backupData)

      // Validate backup data structure
      if (!data.version || !data.exportedAt) {
        throw new Error('Invalid backup format')
      }

      // Restore data to localStorage
      if (data.accounts) localStorage.setItem('zalo-accounts', JSON.stringify(data.accounts))
      if (data.friends) localStorage.setItem('zalo-friends', JSON.stringify(data.friends))
      if (data.groups) localStorage.setItem('zalo-groups', JSON.stringify(data.groups))
      if (data.templates) localStorage.setItem('zalo-templates', JSON.stringify(data.templates))
      if (data.config) localStorage.setItem('zalo-app', JSON.stringify(data.config))

      toast.success(t('settings.importSuccess'))
      setBackupData('')
      setShowRestoreModal(false)

      // Reload app after 2 seconds
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      console.error('Import data error:', error)
      toast.error(t('settings.importFailed'))
    }
  }

  const handleClearData = () => {
    if (window.confirm(t('settings.clearDataConfirm'))) {
      localStorage.clear()
      toast.success(t('settings.clearDataSuccess'))
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">{t('settings.title')}</h1>
          <p className="text-secondary-600 mt-1">
            {t('settings.subtitle')}
          </p>
        </div>
      </div>

      {/* License Info */}
      <Card className={isLicenseValid ? 'border-green-200' : 'border-yellow-200'}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="w-5 h-5" />
            <span>{t('settings.license')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLicenseValid && licenseInfo ? (
            <>
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{t('settings.licenseActivated')}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-secondary-500">{t('settings.product')}:</span>
                  <p className="font-medium">{licenseInfo.product}</p>
                </div>
                <div>
                  <span className="text-secondary-500">{t('settings.type')}:</span>
                  <p className="font-medium capitalize">{licenseInfo.type}</p>
                </div>
                <div>
                  <span className="text-secondary-500">{t('settings.expiryDate')}:</span>
                  <p className="font-medium">
                    {licenseInfo.isLifetime ? t('settings.lifetime') : new Date(licenseInfo.expiryDate).toLocaleDateString(config.language === 'vi' ? 'vi-VN' : 'en-US')}
                  </p>
                </div>
                <div>
                  <span className="text-secondary-500">{t('settings.devices')}:</span>
                  <p className="font-medium">{licenseInfo.activeDevices}/{licenseInfo.maxDevices}</p>
                </div>
              </div>

              {!licenseInfo.isLifetime && licenseInfo.daysRemaining <= 7 && (
                <div className="flex items-center p-3 bg-yellow-50 rounded-lg text-yellow-700">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  <span className="text-sm">{t('settings.licenseExpiringSoon', { days: licenseInfo.daysRemaining })}</span>
                </div>
              )}

              <div className="pt-3 border-t">
                <div className="text-xs text-secondary-500 mb-2">
                  HWID: <span className="font-mono">{hwid}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(t('settings.deactivateConfirm'))) {
                      clearLicense()
                      toast.success(t('settings.deactivateSuccess'))
                      window.location.reload()
                    }
                  }}
                  className="text-red-600"
                >
                  {t('settings.deactivate')}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
              <p className="text-secondary-600">{t('settings.licenseNotActivated')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="w-5 h-5" />
            <span>{t('settings.appearance')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-3">
              {t('settings.theme')}
            </label>
            <div className="flex space-x-2">
              <Button
                variant={config.theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('light')}
                icon={<Sun className="w-4 h-4" />}
              >
                {t('settings.themeLight')}
              </Button>
              <Button
                variant={config.theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('dark')}
                icon={<Moon className="w-4 h-4" />}
              >
                {t('settings.themeDark')}
              </Button>
              <Button
                variant={config.theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleThemeChange('system')}
                icon={<Monitor className="w-4 h-4" />}
              >
                {t('settings.themeSystem')}
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-3">
              {t('settings.language')}
            </label>
            <div className="flex space-x-2">
              <Button
                variant={config.language === 'vi' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleLanguageChange('vi')}
                icon={<Globe className="w-4 h-4" />}
              >
                {t('settings.languageVi')}
              </Button>
              <Button
                variant={config.language === 'en' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleLanguageChange('en')}
                icon={<Globe className="w-4 h-4" />}
              >
                {t('settings.languageEn')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="w-5 h-5" />
            <span>{t('settings.notifications')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-secondary-900">{t('settings.desktopNotifications')}</h4>
              <p className="text-sm text-secondary-600">{t('settings.desktopNotificationsDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.notifications}
                onChange={(e) => updateConfig({ notifications: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-secondary-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-secondary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Message Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SettingsIcon className="w-5 h-5" />
            <span>{t('settings.messageSettings')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              {t('settings.messageDelay')}
            </label>
            <Input
              type="number"
              value={Math.round((config.messageDelay || 0) / 1000)}
              onChange={(e) => updateConfig({ messageDelay: Math.max(0, Number(e.target.value) || 0) * 1000 })}
              min={0}
              max={600}
              step={1}
            />
            <p className="text-xs text-secondary-500 mt-1">
              {t('settings.messageDelayDesc')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              {t('settings.maxRetries')}
            </label>
            <Input
              type="number"
              value={config.maxRetries}
              onChange={(e) => updateConfig({ maxRetries: Number(e.target.value) })}
              min={0}
              max={10}
            />
            <p className="text-xs text-secondary-500 mt-1">
              {t('settings.maxRetriesDesc')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Backup Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>{t('settings.backup')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-secondary-900">{t('settings.autoBackup')}</h4>
              <p className="text-sm text-secondary-600">{t('settings.autoBackupDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.backupEnabled}
                onChange={(e) => updateConfig({ backupEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-secondary-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-secondary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {config.backupEnabled && (
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                {t('settings.backupInterval')}
              </label>
              <Input
                type="number"
                value={config.backupInterval}
                onChange={(e) => updateConfig({ backupInterval: Number(e.target.value) })}
                min={1}
                max={168}
              />
              <p className="text-xs text-secondary-500 mt-1">
                {t('settings.backupIntervalDesc')}
              </p>
            </div>
          )}

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleExportData}
              icon={<Download className="w-4 h-4" />}
            >
              {t('settings.exportData')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRestoreModal(true)}
              icon={<Upload className="w-4 h-4" />}
            >
              {t('settings.importData')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>{t('settings.security')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-secondary-900">{t('settings.autoSave')}</h4>
              <p className="text-sm text-secondary-600">{t('settings.autoSaveDesc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoSave}
                onChange={(e) => updateConfig({ autoSave: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-secondary-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-secondary-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="pt-4 border-t border-secondary-200">
            <Button
              variant="outline"
              onClick={handleClearData}
              className="text-error-600 border-error-300 hover:bg-error-50"
              icon={<RotateCcw className="w-4 h-4" />}
            >
              {t('settings.clearData')}
            </Button>
            <p className="text-xs text-secondary-500 mt-2">
              {t('settings.clearDataDesc')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* App Info & Update */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-secondary-600">{t('settings.version')}:</span>
              <Badge variant="outline">v{appVersion}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600">Electron:</span>
              <Badge variant="outline">{versions?.electron || 'N/A'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600">Node.js:</span>
              <Badge variant="outline">{versions?.node || 'N/A'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-600">Chrome:</span>
              <Badge variant="outline">{versions?.chrome || 'N/A'}</Badge>
            </div>
          </div>
          
          <div className="pt-4 border-t border-secondary-200">
            <Button
              variant="outline"
              onClick={async () => {
                const api = (window as any).electronAPI
                if (!api?.updater) {
                  toast.error(t('settings.updateUnavailable'))
                  return
                }
                toast.loading(t('settings.checkingUpdate'), { id: 'check-update' })
                const result = await api.updater.checkForUpdates()
                toast.dismiss('check-update')
                if (!result.success) {
                  toast.error(`${t('common.error')}: ${result.error}`)
                } else if (!result.updateInfo?.version || result.updateInfo.version === appVersion) {
                  toast.success(t('settings.updateNotAvailable'))
                }
              }}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              {t('settings.checkUpdate')}
            </Button>
            <p className="text-xs text-secondary-500 mt-2">
              {t('settings.checkUpdateDesc')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Restore Data Modal */}
      <Modal
        open={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        title={t('settings.restoreTitle')}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              {t('settings.restorePlaceholder')}
            </label>
            <textarea
              value={backupData}
              onChange={(e) => setBackupData(e.target.value)}
              placeholder={t('settings.restorePlaceholder')}
              rows={10}
              className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
          </div>

          <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg">
            <p className="text-sm text-warning-800">
              <strong>{t('common.warning')}:</strong> {t('settings.restoreWarning')}
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowRestoreModal(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleImportData}
              disabled={!backupData.trim()}
            >
              {t('settings.importData')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Settings
