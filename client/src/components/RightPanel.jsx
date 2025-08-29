import React, { useState, useEffect } from 'react'
import { Settings, Zap, Database, Monitor, ChevronDown, ChevronRight, RefreshCw, TestTube, AlertCircle, CheckCircle } from 'lucide-react'
import { useJob } from '../context/JobContext'
import { useWebSocket } from '../context/WebSocketContext'
import axios from 'axios'

const RightPanel = () => {
  const { jobs, activeJob, setActiveJob, createJob } = useJob()
  const { metrics } = useWebSocket()
  const [newJobName, setNewJobName] = useState('')
  const [activeTab, setActiveTab] = useState('jobs')
  const [availableModels, setAvailableModels] = useState([])
  const [modelLoading, setModelLoading] = useState(false)
  const [testResults, setTestResults] = useState({})
  const [settings, setSettings] = useState({
    // Model Configuration
    modelUrl: 'http://10.4.0.15:11434',
    modelName: 'benhaotang/Nanonets-OCR-s:latest',
    keepAlive: '5m',
    parallelRequests: 2,
    requestTimeout: 30000,
    
    // Enhanced Vision Prompt for new pattern
    visionPrompt: 'Extract the passport number from this image. The passport number can be in one of these formats: 1) Single letter C, D, E, or S followed by 8 digits (e.g., C12345678), or 2) Two letters from C, D, E, S, N followed by 7 digits (e.g., CD1234567). Return only JSON: {"passport_number": "C12345678", "confidence": 85}',
    
    // Enhancement Settings
    enhancement: 'standard',
    targetHeight: 90,
    contrastBoost: 1.5,
    sharpenAmount: 1.0,
    denoiseStrength: 0.5,
    
    // OCR Processing with new pattern
    confThreshold: 80,
    patternRegex: '^(?:(?:[CDES][0-9]{8})|(?:[CDESN]{2}[0-9]{7}))$',
    forceParseIndex: false,
    parseIndex: 0,
    
    // Duplicate Detection
    dupPhashThreshold: 10,
    textDistanceThreshold: 0.8,
    autoConfirmDuplicates: false,
    
    // System Performance
    preprocessWorkers: 2,
    ocrWorkers: 2,
    ramTargetPct: 60,
    maxQueueSize: 1000,
    
    // Database & Storage
    databaseType: 'sqlite',
    databaseUrl: '',
    storageRoot: './storage',
    enableWalMode: true,
    backupInterval: 24,
    
    // Security & Access
    enableAuth: false,
    sessionTimeout: 8,
    allowedIPs: '',
    logLevel: 'info'
  })

  useEffect(() => {
    loadSettings()
    fetchAvailableModels()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await axios.get('/api/settings')
      setSettings(prev => ({ ...prev, ...response.data }))
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const saveSettings = async () => {
    try {
      await axios.post('/api/settings', settings)
      setTestResults({ settings: { status: 'success', message: 'Settings saved successfully' } })
    } catch (error) {
      console.error('Error saving settings:', error)
      setTestResults({ settings: { status: 'error', message: 'Failed to save settings' } })
    }
  }

  const fetchAvailableModels = async () => {
    setModelLoading(true)
    try {
      const response = await axios.get(`${settings.modelUrl}/api/tags`)
      setAvailableModels(response.data.models || [])
      setTestResults(prev => ({ 
        ...prev, 
        connection: { status: 'success', message: 'Connected to model server' }
      }))
    } catch (error) {
      console.error('Error fetching models:', error)
      setAvailableModels([])
      setTestResults(prev => ({ 
        ...prev, 
        connection: { status: 'error', message: 'Cannot connect to model server' }
      }))
    } finally {
      setModelLoading(false)
    }
  }

  const testModelConnection = async () => {
    try {
      const testPrompt = {
        model: settings.modelName,
        prompt: 'Hello, can you see this?',
        stream: false
      }
      
      const response = await axios.post(`${settings.modelUrl}/api/generate`, testPrompt)
      setTestResults(prev => ({ 
        ...prev, 
        model: { status: 'success', message: 'Model responding correctly' }
      }))
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        model: { status: 'error', message: `Model test failed: ${error.message}` }
      }))
    }
  }

  const testDatabaseConnection = async () => {
    try {
      const response = await axios.get('/api/database/test')
      setTestResults(prev => ({ 
        ...prev, 
        database: { status: 'success', message: 'Database connection OK' }
      }))
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        database: { status: 'error', message: `Database error: ${error.message}` }
      }))
    }
  }

  const handleCreateJob = async () => {
    if (newJobName.trim()) {
      try {
        await createJob(newJobName.trim())
        setNewJobName('')
      } catch (error) {
        console.error('Error creating job:', error)
      }
    }
  }

  const tabs = [
    { id: 'jobs', label: 'Jobs', icon: Database },
    { id: 'settings', label: 'Setup', icon: Settings },
    { id: 'monitor', label: 'Monitor', icon: Monitor }
  ]

  const TestButton = ({ onClick, testKey, label }) => {
    const result = testResults[testKey]
    return (
      <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all ${
          result?.status === 'success' ? 'bg-emerald-100 text-emerald-800' :
          result?.status === 'error' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {result?.status === 'success' ? <CheckCircle className="w-4 h-4" /> :
         result?.status === 'error' ? <AlertCircle className="w-4 h-4" /> :
         <TestTube className="w-4 h-4" />}
        <span>{label}</span>
      </button>
    )
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-lg">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'jobs' && (
          <div className="p-6">
            {/* Job Creation */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Job</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter job name..."
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateJob()}
                />
                <button
                  onClick={handleCreateJob}
                  disabled={!newJobName.trim()}
                  className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 transition-all font-medium"
                >
                  Create Job
                </button>
              </div>
            </div>

            {/* Active Jobs */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Jobs</h3>
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => setActiveJob(job)}
                    className={`p-4 rounded-xl cursor-pointer transition-all ${
                      activeJob?.id === job.id 
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 shadow-md' 
                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900">{job.name}</div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        job.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-800' :
                        job.status === 'PAUSED' ? 'bg-amber-100 text-amber-800' :
                        job.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {job.image_count || 0} images • Created {new Date(job.created_ts).toLocaleDateString()}
                    </div>
                    
                    {/* Progress bar for active job */}
                    {activeJob?.id === job.id && job.status === 'RUNNING' && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Processing...</span>
                          <span>67%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-gradient-to-r from-blue-600 to-blue-700 h-2 rounded-full" style={{ width: '67%' }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-6 space-y-8">
            {/* Model Configuration */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <span>Model Configuration</span>
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model Server Endpoint
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={settings.modelUrl}
                      onChange={(e) => setSettings({ ...settings, modelUrl: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="http://10.4.0.15:11434"
                    />
                    <button
                      onClick={fetchAvailableModels}
                      disabled={modelLoading}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      <RefreshCw className={`w-4 h-4 ${modelLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  {testResults.connection && (
                    <div className={`mt-2 text-sm ${
                      testResults.connection.status === 'success' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {testResults.connection.message}
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Available Models
                  </label>
                  <div className="relative">
                    <select
                      value={settings.modelName}
                      onChange={(e) => setSettings({ ...settings, modelName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {availableModels.length === 0 ? (
                        <option value="benhaotang/Nanonets-OCR-s:latest">benhaotang/Nanonets-OCR-s:latest (default)</option>
                      ) : (
                        availableModels.map((model) => (
                          <option key={model.name} value={model.name}>
                            {model.name} ({(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Keep Alive
                    </label>
                    <input
                      type="text"
                      value={settings.keepAlive}
                      onChange={(e) => setSettings({ ...settings, keepAlive: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="5m"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parallel Requests
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={settings.parallelRequests}
                      onChange={(e) => setSettings({ ...settings, parallelRequests: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vision Prompt Template
                  </label>
                  <textarea
                    value={settings.visionPrompt}
                    onChange={(e) => setSettings({ ...settings, visionPrompt: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    Optimized for passport formats: Single letter + 8 digits OR Two letters + 7 digits
                  </div>
                </div>

                <TestButton 
                  onClick={testModelConnection} 
                  testKey="model" 
                  label="Test Model" 
                />
              </div>
            </div>

            {/* OCR Processing */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">OCR Processing</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confidence Threshold: {settings.confThreshold}%
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    value={settings.confThreshold}
                    onChange={(e) => setSettings({ ...settings, confThreshold: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>50%</span>
                    <span>95%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pattern Validation Regex
                  </label>
                  <input
                    type="text"
                    value={settings.patternRegex}
                    onChange={(e) => setSettings({ ...settings, patternRegex: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    placeholder="^(?:(?:[CDES][0-9]{8})|(?:[CDESN]{2}[0-9]{7}))$"
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    Current pattern matches: C12345678, D87654321, CD1234567, EN9876543, etc.
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="forceParseIndex"
                    checked={settings.forceParseIndex}
                    onChange={(e) => setSettings({ ...settings, forceParseIndex: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="forceParseIndex" className="text-sm text-gray-700">
                    Force Parse Index (split tokens by whitespace)
                  </label>
                </div>

                {settings.forceParseIndex && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parse Index (0-based)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={settings.parseIndex}
                      onChange={(e) => setSettings({ ...settings, parseIndex: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Image Enhancement */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Image Enhancement</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enhancement Profile
                  </label>
                  <select
                    value={settings.enhancement}
                    onChange={(e) => setSettings({ ...settings, enhancement: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm appearance-none bg-white"
                  >
                    <option value="simple">Simple B&W</option>
                    <option value="standard">Standard Enhancement</option>
                    <option value="advanced">Advanced Processing</option>
                    <option value="full">Full Preprocessing</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Height (px)
                    </label>
                    <input
                      type="number"
                      min="60"
                      max="200"
                      value={settings.targetHeight}
                      onChange={(e) => setSettings({ ...settings, targetHeight: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contrast Boost
                    </label>
                    <input
                      type="number"
                      min="1.0"
                      max="3.0"
                      step="0.1"
                      value={settings.contrastBoost}
                      onChange={(e) => setSettings({ ...settings, contrastBoost: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* System Performance */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Performance</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preprocess Workers
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={settings.preprocessWorkers}
                      onChange={(e) => setSettings({ ...settings, preprocessWorkers: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      OCR Workers
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={settings.ocrWorkers}
                      onChange={(e) => setSettings({ ...settings, ocrWorkers: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RAM Target: {settings.ramTargetPct}%
                  </label>
                  <input
                    type="range"
                    min="40"
                    max="90"
                    value={settings.ramTargetPct}
                    onChange={(e) => setSettings({ ...settings, ramTargetPct: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Database & Storage */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Database & Storage</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Database Type
                  </label>
                  <select
                    value={settings.databaseType}
                    onChange={(e) => setSettings({ ...settings, databaseType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm appearance-none bg-white"
                  >
                    <option value="sqlite">SQLite (Single Server)</option>
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL/MariaDB</option>
                  </select>
                </div>

                {settings.databaseType !== 'sqlite' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Database Connection URL
                    </label>
                    <input
                      type="text"
                      value={settings.databaseUrl}
                      onChange={(e) => setSettings({ ...settings, databaseUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                      placeholder="postgresql://user:pass@host:5432/dbname"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Storage Root Path
                  </label>
                  <input
                    type="text"
                    value={settings.storageRoot}
                    onChange={(e) => setSettings({ ...settings, storageRoot: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    placeholder="./storage"
                  />
                </div>

                <TestButton 
                  onClick={testDatabaseConnection} 
                  testKey="database" 
                  label="Test Database" 
                />
              </div>
            </div>

            {/* Duplicate Detection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Duplicate Detection</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    pHash Threshold: {settings.dupPhashThreshold}
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    value={settings.dupPhashThreshold}
                    onChange={(e) => setSettings({ ...settings, dupPhashThreshold: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="autoConfirmDuplicates"
                    checked={settings.autoConfirmDuplicates}
                    onChange={(e) => setSettings({ ...settings, autoConfirmDuplicates: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="autoConfirmDuplicates" className="text-sm text-gray-700">
                    Auto-confirm obvious duplicates (pHash &lt; 3)
                  </label>
                </div>
              </div>
            </div>

            {/* Save Settings */}
            <div className="pt-4 border-t border-gray-200">
              <button 
                onClick={saveSettings}
                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all font-medium"
              >
                Save All Settings
              </button>
              {testResults.settings && (
                <div className={`mt-2 text-sm text-center ${
                  testResults.settings.status === 'success' ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {testResults.settings.message}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">System Monitor</h3>
            
            {/* Real-time Metrics */}
            <div className="space-y-6">
              {/* CPU Usage */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                  <span className="text-sm font-semibold text-gray-900">{metrics.cpu}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      metrics.cpu > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                      metrics.cpu > 60 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                      'bg-gradient-to-r from-emerald-500 to-emerald-600'
                    }`}
                    style={{ width: `${metrics.cpu}%` }}
                  ></div>
                </div>
              </div>

              {/* RAM Usage */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                  <span className="text-sm font-semibold text-gray-900">{metrics.ram}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      metrics.ram > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                      metrics.ram > 60 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                      'bg-gradient-to-r from-blue-500 to-blue-600'
                    }`}
                    style={{ width: `${metrics.ram}%` }}
                  ></div>
                </div>
              </div>

              {/* Processing Queue */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3">Processing Queues</h4>
                <div className="space-y-3">
                  {Object.entries(metrics.queueDepths || {}).map(([queue, depth]) => (
                    <div key={queue} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{queue}</span>
                      <span className="px-2 py-1 bg-white rounded text-sm font-medium">{depth}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Throughput */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-blue-800">Current Throughput</div>
                    <div className="text-2xl font-bold text-blue-900">{metrics.throughput}</div>
                    <div className="text-sm text-blue-700">images/minute</div>
                  </div>
                  <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6 text-blue-700" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RightPanel