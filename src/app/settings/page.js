'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { useTheme } from '@/lib/theme'
import {
  ArrowLeft,
  Moon,
  Sun,
  Monitor,
  Bell,
  Database,
  Trash2,
  Download,
  Shield,
  Info
} from 'lucide-react'

const STORAGE_KEY = 'anker-charging-hub-chat-history'
const SETTINGS_KEY = 'anker-charging-hub-settings'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState({
    notifications: true,
    autoSave: true,
    showSources: true,
    compactMode: false
  })
  const [stats, setStats] = useState({
    messages: 0,
    storageUsed: '0 KB'
  })

  // Load settings and calculate stats
  useEffect(() => {
    // Load saved settings
    try {
      const saved = localStorage.getItem(SETTINGS_KEY)
      if (saved) {
        setSettings(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }

    // Calculate storage stats
    try {
      const chatHistory = localStorage.getItem(STORAGE_KEY)
      if (chatHistory) {
        const parsed = JSON.parse(chatHistory)
        const bytes = new Blob([chatHistory]).size
        setStats({
          messages: parsed.length - 1, // Exclude welcome message
          storageUsed: formatBytes(bytes)
        })
      }
    } catch (e) {
      console.error('Failed to calculate stats:', e)
    }
  }, [])

  // Save settings when changed
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }, [settings])

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleClearData = () => {
    if (confirm('Clear all chat history and cached data? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY)
      setStats({ messages: 0, storageUsed: '0 B' })
    }
  }

  const handleExportData = () => {
    const data = {
      settings,
      chatHistory: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
      exportedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `anker-charging-hub-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Logo />
          </div>
          <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Appearance */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <Sun className="w-5 h-5" />
            Appearance
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">Theme</label>
              <div className="flex gap-2">
                {[
                  { value: 'light', icon: Sun, label: 'Light' },
                  { value: 'dark', icon: Moon, label: 'Dark' },
                  { value: 'system', icon: Monitor, label: 'System' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                      theme === option.value
                        ? 'border-[#00A0E9] bg-[#00A0E9]/5 text-[#00A0E9]'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <option.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Preferences
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
            <SettingToggle
              label="Auto-save chat history"
              description="Automatically save conversations to browser storage"
              checked={settings.autoSave}
              onChange={(v) => updateSetting('autoSave', v)}
            />
            <SettingToggle
              label="Show source citations"
              description="Display document sources under AI responses"
              checked={settings.showSources}
              onChange={(v) => updateSetting('showSources', v)}
            />
            <SettingToggle
              label="Compact mode"
              description="Reduce spacing for more content on screen"
              checked={settings.compactMode}
              onChange={(v) => updateSetting('compactMode', v)}
            />
          </div>
        </section>

        {/* Data & Storage */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data & Storage
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Stats */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Chat messages</span>
                <span className="text-gray-800 dark:text-gray-200 font-medium">{stats.messages}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500 dark:text-gray-400">Storage used</span>
                <span className="text-gray-800 dark:text-gray-200 font-medium">{stats.storageUsed}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 flex gap-3">
              <button
                onClick={handleExportData}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">Export All</span>
              </button>
              <button
                onClick={handleClearData}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm font-medium">Clear Data</span>
              </button>
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5" />
            About
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Version</span>
                <span className="text-gray-800 dark:text-gray-200">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">AI Model</span>
                <span className="text-gray-800 dark:text-gray-200">Claude (Anthropic)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Framework</span>
                <span className="text-gray-800 dark:text-gray-200">Next.js 14</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Anker Charging Knowledge Hub
                <br />
                Internal Use Only
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function SettingToggle({ label, description, checked, onChange }) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-[#00A0E9]' : 'bg-gray-200 dark:bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
