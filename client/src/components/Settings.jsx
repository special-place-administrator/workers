import React, { useState, useEffect } from 'react'
import { Save, RotateCcw, TestTube, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import axios from 'axios'

const Settings = () => {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/settings')
      
      if (response.data.success) {
        // Provide default values for missing settings
        const defaultSettings = {
          model_url: 'http://10.4.0.15:11434',
          model_name: 'benhaotang/Nanonets-OCR-s:latest',
          vision_prompt: 'Extract the passport number from this image. Return only JSON: {"passport_number": "C12345678", "confidence": 85}',
          pattern_regex: '^(?:(?:[CDES][0-9]{8})|(?:[CDESN]{2}[0-9]{7}))$',
          conf_threshold: 80,
          parallel_requests: 3,
          keep_alive: '5m',
          enhancement_profile: 'standard',
          duplicate_threshold: 5,
          ...response.data.settings
        }
        
        setSettings(defaultSettings)
      } else {
        console.error('Failed to load settings:', response.data.error)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      const response = await axios.post('/api/settings', settings)
      
      if (response.data.success) {
        alert('Settings saved successfully!')
      } else {
        alert('Failed to save settings: ' + (response.data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings: ' + (error.response?.data?.error || error.message))
    } finally {
      setSaving(false)
    }
  }

  const testSystem = async () => {
    try {
      setTesting(true)
      const response = await axios.post('/api/processing/test')
      setTestResults(response.data)
    } catch (error) {
      console.error('Error testing system:', error)
      setTestResults({
        success: false,
        error: error.message,
        tests: {}
      })
    } finally {
      setTesting(false)
    }
  }

  const resetToDefaults = () => {
    const defaults = {
      model_url: 'http://10.4.0.15:11434',
      model_name: 'benhaotang/Nanonets-OCR-s:latest',
      vision_prompt: 'Extract the passport number from this image. Return only JSON: {"passport_number": "C12345678", "confidence": 85}',
      pattern_regex: '^(?:(?:[CDES][0-9]{8})|(?:[CDESN]{2}[0-9]{7}))$',
      conf_threshold: 80,
      parallel_requests: 3,
      keep_alive: '5m',
      enhancement_profile: 'standard',
      duplicate_threshold: 5
    }
    setSettings(defaults)
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const getTestIcon = (passed) => {
    if (passed === true) return <CheckCircle className="w-5 h-5 text-emerald-500" />
    if (passed === false) return <XCircle className="w-5 h-5 text-red-500" />
    return <AlertTriangle className="w-5 h-5 text-gray-400" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading settings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
              <p className="text-gray-600 mt-1">Configure OCR models, processing parameters, and system behavior</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={testSystem}
                disabled={testing}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {testing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4" />
                    <span>Test System</span>
                  </>
                )}
              </button>
              <button
                onClick={resetToDefaults}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Defaults</span>
              </button>
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Test Results */}
        {testResults && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Test Results</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Ollama Connection</span>
                {getTestIcon(testResults.tests?.ollamaConnection)}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Model Available</span>
                {getTestIcon(testResults.tests?.modelAvailable)}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Database Access</span>
                {getTestIcon(testResults.tests?.databaseAccess)}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Storage Access</span>
                {getTestIcon(testResults.tests?.storageAccess)}
              </div>
              {testResults.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{testResults.error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Model Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Model Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model URL
              </label>
              <input
                type="text"
                value={settings.model_url || ''}
                onChange={(e) => updateSetting('model_url', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="http://10.4.0.15:11434"
              />
              <p className="text-xs text-gray-500 mt-1">Ollama server endpoint</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model Name
              </label>
              <input
                type="text"
                value={settings.model_name || ''}
                onChange={(e) => updateSetting('model_name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="benhaotang/Nanonets-OCR-s:latest"
              />
              <p className="text-xs text-gray-500 mt-1">Vision model for OCR</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confidence Threshold (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.conf_threshold || 80}
                onChange={(e) => updateSetting('conf_threshold', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum confidence for auto-accept</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parallel Requests
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.parallel_requests || 3}
                onChange={(e) => updateSetting('parallel_requests', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Concurrent processing jobs</p>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vision Prompt
            </label>
            <textarea
              value={settings.vision_prompt || ''}
              onChange={(e) => updateSetting('vision_prompt', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Extract the passport number from this image..."
            />
            <p className="text-xs text-gray-500 mt-1">Prompt sent to vision model</p>
          </div>
        </div>

        {/* Validation Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Validation Settings</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pattern Regex
              </label>
              <input
                type="text"
                value={settings.pattern_regex || ''}
                onChange={(e) => updateSetting('pattern_regex', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="^(?:(?:[CDES][0-9]{8})|(?:[CDESN]{2}[0-9]{7}))$"
              />
              <p className="text-xs text-gray-500 mt-1">Regular expression for passport number validation</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enhancement Profile
                </label>
                <select
                  value={settings.enhancement_profile || 'standard'}
                  onChange={(e) => updateSetting('enhancement_profile', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="none">No Enhancement</option>
                  <option value="basic">Basic (Contrast)</option>
                  <option value="standard">Standard (Recommended)</option>
                  <option value="aggressive">Aggressive</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Image preprocessing level</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duplicate Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={settings.duplicate_threshold || 5}
                  onChange={(e) => updateSetting('duplicate_threshold', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Image similarity threshold</p>
              </div>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keep Alive
              </label>
              <input
                type="text"
                value={settings.keep_alive || '5m'}
                onChange={(e) => updateSetting('keep_alive', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="5m"
              />
              <p className="text-xs text-gray-500 mt-1">Model keep-alive duration</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings