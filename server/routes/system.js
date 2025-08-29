import express from 'express'
import logger from '../services/SystemLogger.js'
import { ProcessingPipeline } from '../services/ProcessingPipeline.js'

export const setupSystemRoutes = (router, services) => {
  // Get system logs
  router.get('/logs', (req, res) => {
    try {
      const filters = {
        level: req.query.level,
        component: req.query.component,
        search: req.query.search,
        since: req.query.since
      }

      const logs = logger.getLogs(filters)
      
      res.json({
        success: true,
        logs: logs,
        stats: logger.getStats()
      })
    } catch (error) {
      console.error('Error fetching logs:', error)
      res.status(500).json({ error: 'Failed to fetch logs' })
    }
  })

  // Clear system logs
  router.delete('/logs', (req, res) => {
    try {
      logger.clearLogs()
      res.json({ success: true, message: 'Logs cleared successfully' })
    } catch (error) {
      console.error('Error clearing logs:', error)
      res.status(500).json({ error: 'Failed to clear logs' })
    }
  })

  // Download system logs
  router.get('/logs/download', (req, res) => {
    try {
      const logContent = logger.exportLogs()
      
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('Content-Disposition', `attachment; filename="system-logs-${new Date().toISOString().split('T')[0]}.txt"`)
      res.send(logContent)
    } catch (error) {
      console.error('Error downloading logs:', error)
      res.status(500).json({ error: 'Failed to download logs' })
    }
  })

  // Get system status
  router.get('/status', (req, res) => {
    try {
      const pipeline = services.processingPipeline || new ProcessingPipeline()
      
      const status = {
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version
        },
        processing: pipeline.getStatus(),
        logs: logger.getStats(),
        environment: {
          modelUrl: process.env.MODEL_URL,
          modelName: process.env.MODEL_NAME,
          confThreshold: process.env.CONF_THRESHOLD
        }
      }

      res.json({ success: true, status })
    } catch (error) {
      console.error('Error fetching system status:', error)
      res.status(500).json({ error: 'Failed to fetch system status' })
    }
  })

  // Test Ollama connection
  router.post('/test-ollama', async (req, res) => {
    try {
      const axios = (await import('axios')).default
      const modelUrl = process.env.MODEL_URL || 'http://10.4.0.15:11434'
      
      // Test basic connectivity
      const response = await axios.get(`${modelUrl}/api/tags`, {
        timeout: 10000
      })

      res.json({
        success: true,
        message: 'Ollama connection successful',
        modelUrl: modelUrl,
        availableModels: response.data.models || []
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        modelUrl: process.env.MODEL_URL || 'http://10.4.0.15:11434'
      })
    }
  })
}