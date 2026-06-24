import { useEffect, useRef, useState, useCallback } from 'react'
import { Save, RotateCcw, Upload, Download, RefreshCw, Trash2, HardDrive } from 'lucide-react'
import { Card, Button, FormItem, Input, Select, Switch, ThemeSwitcher, toast, Modal, Progress } from '../../shared/components'
import { fetchSettings, saveSettings, resetSettings, initializeSystemData, exportSystemConfig, importSystemConfig, getCacheInfo, cleanAllBrowserCache } from './api'
import type { AppSettings, CacheInfo, CacheCleanResult } from './types'
import { defaultSettings } from './types'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import { useBackupStore } from '../../store/backupStore'
import { triggerUpdateCheck } from '../updater/UpdateChecker'

interface BackupExportProgress {
  phase: string
  progress: number
  message: string
  componentId?: string
  componentName?: string
  entryIndex?: number
  entryTotal?: number
  timestamp?: string
}

interface BackupExportLogItem {
  id: number
  phase: string
  time: string
  text: string
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ["B", "KB", "MB", "GB"]
  const k = 1024
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  return (bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<'none' | 'init' | 'export' | 'import-reset' | 'import-merge'>('none')
  const [exportProgress, setExportProgress] = useState<BackupExportProgress | null>(null)
  const [importProgress, setImportProgress] = useState<BackupExportProgress | null>(null)
  const [exportLogs, setExportLogs] = useState<BackupExportLogItem[]>([])
  const exportLogsRef = useRef<HTMLDivElement | null>(null)
  const setImportState = useBackupStore((s) => s.setImportState)
  const clearImportState = useBackupStore((s) => s.clearImportState)
  // Cache cleanup state
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null)
  const [cacheLoading, setCacheLoading] = useState(false)
  const [cacheCleaning, setCacheCleaning] = useState(false)
  const [cacheResult, setCacheResult] = useState<CacheCleanResult | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    const onExportProgress = (payload: BackupExportProgress) => {
      if (!payload || typeof payload !== 'object') {
        return
      }
      const phase = typeof payload.phase === 'string' ? payload.phase : 'writing'
      if (phase === 'cancelled') {
        setExportProgress(null)
        setExportLogs([])
        return
      }
      const progress = Number.isFinite(payload.progress) ? Math.max(0, Math.min(100, Math.round(payload.progress))) : 0
      const message = typeof payload.message === 'string' && payload.message.trim() ? payload.message.trim() : '正在导出...'
      const componentId = typeof payload.componentId === 'string' ? payload.componentId.trim() : ''
      const componentName = typeof payload.componentName === 'string' ? payload.componentName.trim() : ''
      const entryIndex = Number.isFinite(payload.entryIndex) ? Math.max(0, Math.round(payload.entryIndex || 0)) : 0
      const entryTotal = Number.isFinite(payload.entryTotal) ? Math.max(0, Math.round(payload.entryTotal || 0)) : 0
      const timestamp = typeof payload.timestamp === 'string' && payload.timestamp.trim()
        ? payload.timestamp.trim()
        : new Date().toLocaleTimeString('zh-CN', { hour12: false })

      setExportProgress({
        phase,
        progress,
        message,
        componentId: componentId || undefined,
        componentName: componentName || undefined,
        entryIndex: entryIndex || undefined,
        entryTotal: entryTotal || undefined,
        timestamp,
      })

      const prefix = componentName ? `[${componentName}] ` : componentId ? `[${componentId}] ` : ''
      const text = `${prefix}${message}`
      setExportLogs(prev => {
        const last = prev[prev.length - 1]
        if (last && last.text === text && last.phase === phase) {
          return prev
        }
        const next = [...prev, { id: Date.now() + Math.floor(Math.random() * 1000), phase, time: timestamp, text }]
        return next.length > 120 ? next.slice(next.length - 120) : next
      })
    }

    EventsOn('backup:export:progress', onExportProgress)
    return () => {
      EventsOff('backup:export:progress')
    }
  }, [])

  useEffect(() => {
    const onImportProgress = (payload: BackupExportProgress) => {
      if (!payload || typeof payload !== 'object') {
        return
      }
      const phase = typeof payload.phase === 'string' ? payload.phase : 'importing'
      if (phase === 'cancelled') {
        setImportProgress(null)
        return
      }
      const progress = Number.isFinite(payload.progress) ? Math.max(0, Math.min(100, Math.round(payload.progress))) : 0
      const message = typeof payload.message === 'string' && payload.message.trim() ? payload.message.trim() : '正在加载配置...'
      const componentId = typeof payload.componentId === 'string' ? payload.componentId.trim() : ''
      const componentName = typeof payload.componentName === 'string' ? payload.componentName.trim() : ''
      const entryIndex = Number.isFinite(payload.entryIndex) ? Math.max(0, Math.round(payload.entryIndex || 0)) : 0
      const entryTotal = Number.isFinite(payload.entryTotal) ? Math.max(0, Math.round(payload.entryTotal || 0)) : 0
      const timestamp = typeof payload.timestamp === 'string' && payload.timestamp.trim()
        ? payload.timestamp.trim()
        : new Date().toLocaleTimeString('zh-CN', { hour12: false })

      setImportProgress({
        phase,
        progress,
        message,
        componentId: componentId || undefined,
        componentName: componentName || undefined,
        entryIndex: entryIndex || undefined,
        entryTotal: entryTotal || undefined,
        timestamp,
      })
    }

    EventsOn('backup:import:progress', onImportProgress)
    return () => {
      EventsOff('backup:import:progress')
    }
  }, [])

  useEffect(() => {
    const isImporting = actionLoading === 'import-reset' || actionLoading === 'import-merge'
    if (isImporting) {
      setImportState({
        inProgress: true,
        progress: importProgress?.progress ?? 0,
        message: importProgress?.message || '正在加载配置...',
      })
      return
    }
    clearImportState()
  }, [actionLoading, importProgress?.progress, importProgress?.message, setImportState, clearImportState])

  useEffect(() => {
    return () => {
      clearImportState()
    }
  }, [clearImportState])

  useEffect(() => {
    if (!exportLogsRef.current) {
      return
    }
    exportLogsRef.current.scrollTop = exportLogsRef.current.scrollHeight
  }, [exportLogs])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await fetchSettings()
      setSettings(data)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const success = await saveSettings(settings)
      if (success) {
        setHasChanges(false)
        toast.success('设置已保存')
	} else {
	  toast.error('保存失败，请检查浏览器本地存储权限')
      }
    } catch (error: any) {
      toast.error(error?.message || '保存失败，请检查配置')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (confirm('确定要重置所有设置吗？')) {
      const data = await resetSettings()
      setSettings(data)
      setHasChanges(false)
    }
  }

  const handleInitializeSystem = async () => {
    if (!confirm('初始化会清空当前数据并恢复默认状态，是否继续？')) {
      return
    }
    setActionLoading('init')
    try {
      const res = await initializeSystemData()
      if (res.cancelled) {
        toast.info('已取消初始化')
        return
      }
      toast.success(res.message || '初始化完成')
    } catch (error: any) {
      toast.error(error?.message || '初始化失败')
    } finally {
      setActionLoading('none')
    }
  }

  const handleExportSystem = async () => {
    setActionLoading('export')
    setExportLogs([])
    setExportProgress({ phase: 'starting', progress: 0, message: '准备导出...' })
    try {
      const res = await exportSystemConfig()
      if (res.cancelled) {
        setExportProgress(null)
        setExportLogs([])
        toast.info('已取消导出')
        return
      }
      setExportProgress(prev => prev?.phase === 'done'
        ? prev
        : { phase: 'done', progress: 100, message: res.message || '导出完成' })
      toast.success(res.message || '导出完成')
    } catch (error: any) {
      setExportProgress(prev => ({
        phase: 'error',
        progress: prev?.progress ?? 0,
        message: error?.message || '导出失败',
      }))
      setExportLogs(prev => {
        const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
        const text = error?.message || '导出失败'
        const next = [...prev, { id: Date.now() + Math.floor(Math.random() * 1000), phase: 'error', time: timestamp, text }]
        return next.length > 120 ? next.slice(next.length - 120) : next
      })
      toast.error(error?.message || '导出失败')
    } finally {
      setActionLoading('none')
    }
  }

  const handleImportSystem = async (resetFirst: boolean) => {
    setActionLoading(resetFirst ? 'import-reset' : 'import-merge')
    setImportProgress({
      phase: 'starting',
      progress: 0,
      message: resetFirst ? '等待选择 ZIP 配置（先初始化后加载）...' : '等待选择 ZIP 配置（判重合并）...',
    })
    try {
      const res = await importSystemConfig(resetFirst)
      if (res.cancelled) {
        setImportProgress(null)
        toast.info('已取消加载')
        return
      }
      const imported = res.imported ?? 0
      const skipped = res.skipped ?? 0
      const conflicts = res.conflicts ?? 0
      const componentFailed = Number.isFinite(res.componentFailed) ? Math.max(0, Math.round(res.componentFailed || 0)) : 0
      const componentTotal = Number.isFinite(res.componentTotal) ? Math.max(0, Math.round(res.componentTotal || 0)) : 0
      const failedComponents = Array.isArray(res.failedComponents) ? res.failedComponents : []

      if (res.partial || componentFailed > 0) {
        const moduleNames = failedComponents
          .map(item => (item?.componentName || item?.componentId || '').trim())
          .filter(Boolean)
        const moduleHint = moduleNames.length > 0
          ? `：${moduleNames.slice(0, 3).join('、')}${moduleNames.length > 3 ? ` 等 ${moduleNames.length} 个模块` : ''}`
          : ''
        if (componentTotal > 0) {
          const componentSuccess = Math.max(0, componentTotal - componentFailed)
          toast.warning(`加载完成（部分成功）：模块成功 ${componentSuccess}/${componentTotal}，异常 ${componentFailed}${moduleHint}`)
        } else {
          toast.warning(`加载完成（部分成功）：异常模块 ${componentFailed}${moduleHint}`)
        }
      } else {
        toast.success(`加载完成：导入 ${imported}，跳过 ${skipped}，冲突 ${conflicts}`)
      }
      setImportModalOpen(false)
      setImportProgress(null)
    } catch (error: any) {
      setImportProgress(prev => ({
        phase: 'error',
        progress: prev?.progress ?? 0,
        message: error?.message || '加载失败',
      }))
      toast.error(error?.message || '加载失败')
    } finally {
      setActionLoading('none')
    }
  }

  // Cache cleanup handlers

  const handleScanCache = useCallback(async () => {
    setCacheLoading(true)
    setCacheResult(null)
    try {
      const info = await getCacheInfo()
      setCacheInfo(info)
      if (!info || info.totalCacheSize <= 0) {
        toast.info('暂无可清理的缓存')
      }
    } catch (error: any) {
      toast.error(error?.message || '扫描缓存失败')
    } finally {
      setCacheLoading(false)
    }
  }, [])

  const handleCleanCache = useCallback(async () => {
    if (!confirm(`确定要清理所有浏览器实例的缓存吗？

正在运行的实例将被跳过。
清理后 Chrome 会自动重建缓存目录。`)) {
      return
    }
    setCacheCleaning(true)
    setCacheResult(null)
    try {
      const result = await cleanAllBrowserCache()
      if (result) {
        setCacheResult(result)
        toast.success(result.message || '缓存清理完成')
      }
      const info = await getCacheInfo()
      setCacheInfo(info)
    } catch (error: any) {
      toast.error(error?.message || '清理缓存失败')
    } finally {
      setCacheCleaning(false)
    }
  }, [])

    const importRunning = actionLoading === 'import-reset' || actionLoading === 'import-merge'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[var(--color-border-default)] border-t-[var(--color-accent)] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full animate-fade-in">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">系统设置</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">配置应用的各项参数</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
            重置
          </Button>
          <Button variant="danger" size="sm" onClick={handleSave} loading={saving} disabled={!hasChanges}>
            <Save className="w-4 h-4" />
            保存
          </Button>
        </div>
      </div>

      {/* 主题设置 */}
      <Card title="主题设置" subtitle="选择您喜欢的界面主题">
        <ThemeSwitcher />
      </Card>

      {/* 检查更新 */}
      <Card title="软件更新" subtitle="检查并安装最新版本">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--color-text-secondary)]">
            点击右侧按钮立即检查 GitHub 上是否有新版本
          </div>
          <Button variant="secondary" size="sm" onClick={() => triggerUpdateCheck()}>
            <RefreshCw className="w-4 h-4" />
            检查更新
          </Button>
        </div>
      </Card>

      {/* 基础设置 */}
      <Card title="基础设置" subtitle="应用的基本信息配置">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormItem label="应用名称" required>
              <Input
                value={settings.appName}
                onChange={e => handleChange('appName', e.target.value)}
                placeholder="请输入应用名称"
              />
            </FormItem>
            <FormItem label="语言">
              <Select
                value={settings.language}
                onChange={e => handleChange('language', e.target.value)}
                options={[
                  { value: 'zh-CN', label: '简体中文' },
                  { value: 'en-US', label: 'English' },
                ]}
              />
            </FormItem>
          </div>
          <FormItem label="应用描述">
            <Input
              value={settings.appDescription}
              onChange={e => handleChange('appDescription', e.target.value)}
              placeholder="请输入应用描述"
            />
          </FormItem>
        </div>
      </Card>

      {/* 功能设置 */}
      <Card title="功能设置" subtitle="启用或禁用特定功能">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">启用通知</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">接收系统通知和提醒</p>
            </div>
            <Switch
              checked={settings.enableNotifications}
              onChange={v => handleChange('enableNotifications', v)}
            />
          </div>
          
          <div className="h-px bg-[var(--color-border-muted)]" />
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">自动保存</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">自动保存编辑中的内容</p>
            </div>
            <Switch
              checked={settings.enableAutoSave}
              onChange={v => handleChange('enableAutoSave', v)}
            />
          </div>
          
          {settings.enableAutoSave && (
            <div className="pl-4 border-l-2 border-[var(--color-border-muted)]">
              <FormItem label="自动保存间隔（秒）">
                <Input
                  type="number"
                  value={settings.autoSaveInterval}
                  onChange={e => handleChange('autoSaveInterval', parseInt(e.target.value) || 30)}
                  min={5}
                  max={300}
                  className="max-w-[120px]"
                />
              </FormItem>
            </div>
          )}
          
          <div className="h-px bg-[var(--color-border-muted)]" />
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">启用缓存</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">缓存数据以提高性能</p>
            </div>
            <Switch
              checked={settings.cacheEnabled}
              onChange={v => handleChange('cacheEnabled', v)}
            />
          </div>
        </div>
      </Card>

      {/* 高级设置 */}
      <Card title="高级设置" subtitle="高级配置选项">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormItem label="最大上传大小（MB）">
            <Input
              type="number"
              value={settings.maxUploadSize}
              onChange={e => handleChange('maxUploadSize', parseInt(e.target.value) || 10)}
              min={1}
              max={100}
            />
          </FormItem>
          <FormItem label="会话超时（分钟）">
            <Input
              type="number"
              value={settings.sessionTimeout}
              onChange={e => handleChange('sessionTimeout', parseInt(e.target.value) || 30)}
              min={5}
              max={120}
            />
          </FormItem>
          <FormItem label="日志级别">
            <Select
              value={settings.logLevel}
              onChange={e => handleChange('logLevel', e.target.value as AppSettings['logLevel'])}
              options={[
                { value: 'debug', label: 'Debug' },
                { value: 'info', label: 'Info' },
                { value: 'warn', label: 'Warning' },
                { value: 'error', label: 'Error' },
              ]}
            />
          </FormItem>
        </div>
      </Card>

            {/* Cache cleanup */}
      <Card title="缓存清理" subtitle="清理浏览器实例的冗余缓存文件，释放磁盘空间">
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">自动清理缓存</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">定期自动清理浏览器缓存文件</p>
              </div>
              <Switch checked={settings.autoCleanCache} onChange={v => handleChange('autoCleanCache', v)} />
            </div>
            {settings.autoCleanCache && (
              <div className="pl-4 border-l-2 border-[var(--color-border-muted)]">
                <FormItem label="清理间隔">
                  <Select
                    value={String(settings.autoCleanIntervalDays)}
                    onChange={e => handleChange('autoCleanIntervalDays', parseInt(e.target.value) || 7)}
                    options={[
                      { value: '1', label: '每天' },
                      { value: '3', label: '每 3 天' },
                      { value: '7', label: '每周' },
                      { value: '14', label: '每两周' },
                      { value: '30', label: '每月' },
                    ]}
                  />
                </FormItem>
              </div>
            )}
          </div>
          <div className="h-px bg-[var(--color-border-muted)]" />
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="secondary" size="sm" onClick={handleScanCache} loading={cacheLoading}>
                <HardDrive className="w-4 h-4" />扫描缓存
              </Button>
              <Button size="sm" onClick={handleCleanCache} loading={cacheCleaning} disabled={!cacheInfo || cacheInfo.totalCacheSize <= 0}>
                <Trash2 className="w-4 h-4" />立即清理
              </Button>
            </div>
            {cacheInfo && (
              <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">缓存总大小</span>
                  <span className="text-lg font-bold text-[var(--color-accent)]">{formatFileSize(cacheInfo.totalCacheSize)}</span>
                </div>
                {cacheInfo.lastCleanAt && (
                  <p className="text-xs text-[var(--color-text-muted)] mb-2">上次清理：{new Date(cacheInfo.lastCleanAt).toLocaleString('zh-CN')}</p>
                )}
                {cacheInfo.profiles.length > 0 ? (
                  <div className="space-y-1">
                    {cacheInfo.profiles.map(p => (
                      <div key={p.profileId} className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] py-0.5">
                        <span className="truncate max-w-[200px]">{p.profileName}</span>
                        <span>{formatFileSize(p.cacheSize)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)]">暂无缓存数据</p>
                )}
              </div>
            )}
            {cacheResult && (
              <div className="rounded-md px-3 py-2 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                <p><strong>清理完成：</strong> {cacheResult.message}</p>
                {cacheResult.freedBytes > 0 && (
                  <p className="text-xs mt-1">释放空间：{formatFileSize(cacheResult.freedBytes)} &middot; 涉及实例：{cacheResult.cleanedDirs} 个</p>
                )}
              </div>
            )}
            <div className="rounded-md bg-[var(--color-bg-tertiary)] px-3 py-2">
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">清理内容包括：浏览器页面缓存（Cache）、代码缓存（Code Cache）、GPU 缓存（GPUCache）、Service Worker 缓存、Storage 分区缓存等。</p>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-1">⎠ 正在运行的实例将被跳过。清理不会影响您的登录状态、书签、密码、本地存储等核心数据。</p>
            </div>
          </div>
        </div>
      </Card>

      <Card title="配置备份与恢复" subtitle="初始化、导出、加载全量配置与浏览器数据">
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            加载配置时可选择先初始化后全量恢复，或在现有数据上按规则判重合并。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={handleInitializeSystem}
              loading={actionLoading === 'init'}
            >
              <RotateCcw className="w-4 h-4" />
              初始化系统
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportSystem}
              loading={actionLoading === 'export'}
            >
              <Download className="w-4 h-4" />
              导出配置
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setImportProgress(null)
                setImportModalOpen(true)
              }}
            >
              <Upload className="w-4 h-4" />
              加载配置
            </Button>
          </div>
          {exportProgress && (
            <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)]">{exportProgress.message}</span>
                {exportProgress.phase === 'error' && <span className="text-[var(--color-error)]">失败</span>}
                {exportProgress.phase === 'done' && <span className="text-[var(--color-success)]">完成</span>}
                {exportProgress.phase !== 'done' && exportProgress.phase !== 'error' && (
                  <span className="text-[var(--color-text-muted)]">处理中</span>
                )}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                当前组件：
                {' '}
                {exportProgress.componentName || exportProgress.componentId || '准备中'}
                {exportProgress.entryIndex && exportProgress.entryTotal
                  ? `（${exportProgress.entryIndex}/${exportProgress.entryTotal}）`
                  : ''}
              </div>
              <Progress
                percent={exportProgress.progress}
                size="sm"
                status={exportProgress.phase === 'error' ? 'error' : exportProgress.phase === 'done' ? 'success' : 'normal'}
              />
              <div className="rounded border border-[var(--color-border-muted)] bg-[var(--color-bg-primary)] px-2 py-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--color-text-secondary)]">导出日志</span>
                  <span className="text-[var(--color-text-muted)]">{exportLogs.length} 条</span>
                </div>
                <div ref={exportLogsRef} className="max-h-36 overflow-y-auto pr-1 space-y-1">
                  {exportLogs.length === 0 && (
                    <p className="text-xs text-[var(--color-text-muted)]">等待导出日志...</p>
                  )}
                  {exportLogs.map(item => (
                    <div key={item.id} className="text-xs leading-5 font-mono">
                      <span className="text-[var(--color-text-muted)] mr-2">{item.time}</span>
                      <span className={item.phase === 'error' ? 'text-[var(--color-error)]' : item.phase === 'done' ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={importModalOpen}
        onClose={() => {
          if (actionLoading !== 'none') {
            return
          }
          setImportModalOpen(false)
          setImportProgress(null)
        }}
        title="加载配置"
        width="520px"
        closable={!importRunning}
        footer={
          <>
            {!importRunning && (
              <Button
                variant="secondary"
                onClick={() => {
                  setImportModalOpen(false)
                  setImportProgress(null)
                }}
              >
                取消
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => handleImportSystem(true)}
              loading={actionLoading === 'import-reset'}
              disabled={actionLoading !== 'none' && actionLoading !== 'import-reset'}
            >
              是，先初始化后加载
            </Button>
            <Button
              onClick={() => handleImportSystem(false)}
              loading={actionLoading === 'import-merge'}
              disabled={actionLoading !== 'none' && actionLoading !== 'import-merge'}
            >
              否，直接加载并判重
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
          <p>是否先执行初始化再加载 ZIP 配置？</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            选择“是”会先清空当前数据，再全量恢复；选择“否”会在现有数据上做判重合并。
          </p>
          {importProgress && (
            <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)]">{importProgress.message}</span>
                {importProgress.phase === 'error' && <span className="text-[var(--color-error)]">失败</span>}
                {importProgress.phase === 'done' && <span className="text-[var(--color-success)]">完成</span>}
                {importProgress.phase !== 'done' && importProgress.phase !== 'error' && (
                  <span className="text-[var(--color-text-muted)]">加载中</span>
                )}
              </div>
              <Progress
                percent={importProgress.progress}
                size="sm"
                status={importProgress.phase === 'error' ? 'error' : importProgress.phase === 'done' ? 'success' : 'normal'}
              />
              {(importProgress.componentName || importProgress.componentId) && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  当前组件：
                  {' '}
                  {importProgress.componentName || importProgress.componentId}
                  {importProgress.entryIndex && importProgress.entryTotal
                    ? `（${importProgress.entryIndex}/${importProgress.entryTotal}）`
                    : ''}
                </div>
              )}
            </div>
          )}
          {importRunning && (
            <p className="text-xs text-[var(--color-warning)]">
              当前正在加载配置，弹窗不可关闭。若需中断，请直接关闭应用。
            </p>
          )}
        </div>
      </Modal>

    </div>
  )
}
