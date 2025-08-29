import fs from 'fs-extra'
import path from 'path'

class SystemLogger {
  constructor() {
    this.logs = []
    this.maxLogEntries = 10000
    this.logLevels = ['debug', 'info', 'warn', 'error', 'success']
    
    // Initialize log storage
    this.initializeLogger()
  }

  initializeLogger() {
    console.log('SystemLogger initialized')
  }

  log(level, component, message, details = null) {
    const timestamp = new Date().toISOString()
    
    const logEntry = {
      timestamp,
      level,
      component,
      message,
      details
    }

    // Add to in-memory store
    this.logs.push(logEntry)

    // Keep only recent logs in memory
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries)
    }

    // Console output with colors
    const colors = {
      debug: '\x1b[36m',   // Cyan
      info: '\x1b[34m',    // Blue
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      success: '\x1b[32m', // Green
      reset: '\x1b[0m'
    }

    const color = colors[level] || colors.reset
    const resetColor = colors.reset

    console.log(
      `${color}[${timestamp}] ${level.toUpperCase()} [${component}] ${message}${resetColor}`,
      details ? JSON.stringify(details, null, 2) : ''
    )

    // Persist critical logs to file (async, non-blocking)
    if (level === 'error' || level === 'warn') {
      this.persistLogToFile(logEntry).catch(err => {
        console.error('Failed to persist log to file:', err)
      })
    }
  }

  async persistLogToFile(logEntry) {
    try {
      const logDir = path.join(process.cwd(), 'logs')
      await fs.ensureDir(logDir)
      
      const logFile = path.join(logDir, `system-${new Date().toISOString().split('T')[0]}.log`)
      const logLine = `${logEntry.timestamp} [${logEntry.level.toUpperCase()}] [${logEntry.component}] ${logEntry.message}${logEntry.details ? ' ' + JSON.stringify(logEntry.details) : ''}\n`
      
      await fs.appendFile(logFile, logLine)
    } catch (error) {
      console.error('Failed to write log file:', error)
    }
  }

  getLogs(filters = {}) {
    let filteredLogs = [...this.logs]

    if (filters.level && filters.level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level)
    }

    if (filters.component) {
      filteredLogs = filteredLogs.filter(log => 
        log.component.toLowerCase().includes(filters.component.toLowerCase())
      )
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        log.component.toLowerCase().includes(searchLower)
      )
    }

    if (filters.since) {
      const sinceDate = new Date(filters.since)
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= sinceDate)
    }

    return filteredLogs.slice(-1000) // Return last 1000 entries
  }

  clearLogs() {
    this.logs = []
    return true
  }

  exportLogs() {
    return this.logs.map(log => {
      const line = `${log.timestamp} [${log.level.toUpperCase()}] [${log.component}] ${log.message}`
      return log.details ? `${line} ${JSON.stringify(log.details)}` : line
    }).join('\n')
  }

  getStats() {
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)
    const recentLogs = this.logs.filter(log => new Date(log.timestamp).getTime() > oneHourAgo)

    const stats = {
      total: this.logs.length,
      recent: recentLogs.length,
      byLevel: {}
    }

    this.logLevels.forEach(level => {
      stats.byLevel[level] = this.logs.filter(log => log.level === level).length
    })

    return stats
  }
}

// Global logger instance
const logger = new SystemLogger()

// Convenience function for logging
export function logSystem(level, component, message, details = null) {
  logger.log(level, component, message, details)
}

export default logger