import React, { useState, useEffect, useRef } from 'react'
import { X, Terminal, Download, Trash2, Filter, Search, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import axios from 'axios'

const SystemLogsModal = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState([])
  const [filteredLogs, setFilteredLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [logLevel, setLogLevel] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isAtBottom, setIsAtBottom] = useState(true)
  const logsEndRef = useRef(null)
  const logsContainerRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      loadLogs()
      
      // Set up auto-refresh
      const interval = setInterval(() => {
        if (autoRefresh) {
          loadLogs(false) // Don't show loading spinner for auto-refresh
        }
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [isOpen, autoRefresh])

  useEffect(() => {
    // Filter logs when search query or log level changes
    const filtered = logs.filter(log => {
      const matchesLevel = logLevel === 'all' || log.level === logLevel
      const matchesSearch = !searchQuery || 
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.component.toLowerCase().includes(searchQuery.toLowerCase())
      
      return matchesLevel && matchesSearch
    })
    setFilteredLogs(filtered)
  }, [logs, logLevel, searchQuery])

  useEffect(() => {
    // Auto-scroll to bottom if user was at bottom
    if (isAtBottom && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filteredLogs, isAtBottom])

  const loadLogs = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      const response = await axios.get('/api/system/logs')
      setLogs(response.data.logs || [])
    } catch (error) {
      console.error('Error loading system logs:', error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const clearLogs = async () => {
    if (confirm('Are you sure you want to clear all system logs?')) {
      try {
        await axios.delete('/api/system/logs')
        setLogs([])
        setFilteredLogs([])
      } catch (error) {
        console.error('Error clearing logs:', error)
        alert('Failed to clear logs')
      }
    }
  }

  const downloadLogs = async () => {
    try {
      const response = await axios.get('/api/system/logs/download', {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `system-logs-${new Date().toISOString().split('T')[0]}.txt`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading logs:', error)
      alert('Failed to download logs')
    }
  }

  const handleScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current
      const atBottom = scrollHeight - scrollTop <= clientHeight + 50
      setIsAtBottom(atBottom)
    }
  }

  const getLogIcon = (level) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'warn': return <AlertTriangle className="w-4 h-4 text-amber-500" />
      case 'info': return <Info className="w-4 h-4 text-blue-500" />
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500" />
      default: return <Terminal className="w-4 h-4 text-gray-500" />
    }
  }

  const getLogStyle = (level) => {
    switch (level) {
      case 'error': return 'bg-red-50 border-l-red-500 text-red-900'
      case 'warn': return 'bg-amber-50 border-l-amber-500 text-amber-900'
      case 'info': return 'bg-blue-50 border-l-blue-500 text-blue-900'
      case 'success': return 'bg-emerald-50 border-l-emerald-500 text-emerald-900'
      default: return 'bg-gray-50 border-l-gray-400 text-gray-900'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-5/6 mx-4 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Terminal className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">System Logs & Diagnostics</h2>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">
                {autoRefresh ? 'Auto-refreshing' : 'Manual refresh'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>

            {/* Log Level Filter */}
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Levels</option>
              <option value="error">Errors</option>
              <option value="warn">Warnings</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="debug">Debug</option>
            </select>

            {/* Auto Refresh Toggle */}
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Auto-refresh</span>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => loadLogs(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <Terminal className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={downloadLogs}
              className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
            <button
              onClick={clearLogs}
              className="flex items-center space-x-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="p-3 bg-gray-100 border-b border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-6">
              <span>Total: {logs.length} entries</span>
              <span>Filtered: {filteredLogs.length} entries</span>
              <span>Errors: {logs.filter(l => l.level === 'error').length}</span>
              <span>Warnings: {logs.filter(l => l.level === 'warn').length}</span>
            </div>
            <div className="text-gray-600">
              Last updated: {logs.length > 0 ? new Date(logs[logs.length - 1]?.timestamp).toLocaleTimeString() : 'Never'}
            </div>
          </div>
        </div>

        {/* Logs Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-600">Loading system logs...</div>
            </div>
          ) : (
            <div
              ref={logsContainerRef}
              onScroll={handleScroll}
              className="h-full overflow-y-auto font-mono text-sm"
            >
              {filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-2">
                    <Terminal className="w-12 h-12 text-gray-400 mx-auto" />
                    <div className="text-gray-600">
                      {logs.length === 0 ? 'No system logs available' : 'No logs match your filters'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-1">
                  {filteredLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`p-3 border-l-4 rounded-r-lg ${getLogStyle(log.level)}`}
                    >
                      <div className="flex items-start space-x-3">
                        {getLogIcon(log.level)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 text-xs mb-1">
                            <span className="font-medium">{log.timestamp}</span>
                            <span className="px-2 py-1 bg-white bg-opacity-60 rounded uppercase font-bold">
                              {log.level}
                            </span>
                            <span className="text-gray-600">[{log.component}]</span>
                          </div>
                          <div className="text-sm font-medium break-words">
                            {log.message}
                          </div>
                          {log.details && (
                            <div className="text-xs mt-2 p-2 bg-white bg-opacity-60 rounded overflow-x-auto">
                              <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scroll to Bottom Button */}
        {!isAtBottom && (
          <button
            onClick={() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-20 right-8 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          >
            ↓
          </button>
        )}
      </div>
    </div>
  )
}

export default SystemLogsModal