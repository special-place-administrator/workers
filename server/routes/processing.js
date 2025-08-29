import { logSystem } from '../services/SystemLogger.js'
import { getDatabase } from '../database/init.js'

export const setupProcessingRoutes = (router, services) => {
  // Start processing a job
  router.post('/jobs/:jobId/start', async (req, res) => {
    const { jobId } = req.params

    try {
      logSystem('info', 'ProcessingAPI', 'Start processing request received', { jobId })
      
      if (!services.processingPipeline) {
        logSystem('error', 'ProcessingAPI', 'Processing pipeline not initialized')
        return res.status(500).json({
          success: false,
          error: 'Processing pipeline not available'
        })
      }

      // Check if job exists and has images
      const db = getDatabase()
      const job = await getJobWithImages(db, jobId)
      
      if (!job) {
        logSystem('error', 'ProcessingAPI', 'Job not found', { jobId })
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        })
      }

      if (job.imageCount === 0) {
        logSystem('warn', 'ProcessingAPI', 'Job has no images to process', { jobId })
        return res.status(400).json({
          success: false,
          error: 'No images found in job to process'
        })
      }

      logSystem('info', 'ProcessingAPI', 'Starting job processing', { 
        jobId, 
        jobName: job.name,
        imageCount: job.imageCount 
      })

      const started = await services.processingPipeline.startJob(jobId)
      
      if (started) {
        res.json({
          success: true,
          message: `Processing started for ${job.imageCount} images`,
          jobId,
          imageCount: job.imageCount
        })
      } else {
        logSystem('warn', 'ProcessingAPI', 'Failed to start processing', { jobId })
        res.status(400).json({
          success: false,
          error: 'Failed to start processing (already running or no pending images)'
        })
      }
    } catch (error) {
      logSystem('error', 'ProcessingAPI', 'Failed to start processing', { 
        jobId, 
        error: error.message,
        stack: error.stack 
      })
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  // Pause processing
  router.post('/jobs/:jobId/pause', async (req, res) => {
    const { jobId } = req.params

    try {
      logSystem('info', 'ProcessingAPI', 'Pause processing request received', { jobId })
      
      if (!services.processingPipeline) {
        return res.status(500).json({
          success: false,
          error: 'Processing pipeline not available'
        })
      }

      await services.processingPipeline.pauseJob()
      
      res.json({
        success: true,
        message: 'Processing paused',
        jobId
      })
    } catch (error) {
      logSystem('error', 'ProcessingAPI', 'Failed to pause processing', { jobId, error: error.message })
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  // Stop processing
  router.post('/jobs/:jobId/stop', async (req, res) => {
    const { jobId } = req.params

    try {
      logSystem('info', 'ProcessingAPI', 'Stop processing request received', { jobId })
      
      if (!services.processingPipeline) {
        return res.status(500).json({
          success: false,
          error: 'Processing pipeline not available'
        })
      }

      await services.processingPipeline.stopJob()
      
      res.json({
        success: true,
        message: 'Processing stopped',
        jobId
      })
    } catch (error) {
      logSystem('error', 'ProcessingAPI', 'Failed to stop processing', { jobId, error: error.message })
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  // Get processing status
  router.get('/status', (req, res) => {
    try {
      if (!services.processingPipeline) {
        return res.json({
          success: true,
          status: {
            isProcessing: false,
            currentJob: null,
            processedCount: 0,
            totalCount: 0,
            percentage: 0
          }
        })
      }

      const status = services.processingPipeline.getStatus()
      
      logSystem('debug', 'ProcessingAPI', 'Status requested', status)
      
      res.json({
        success: true,
        status
      })
    } catch (error) {
      logSystem('error', 'ProcessingAPI', 'Failed to get processing status', { error: error.message })
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  // Test processing system components
  router.post('/test', async (req, res) => {
    try {
      logSystem('info', 'ProcessingAPI', 'Processing system test requested')
      
      // Test Ollama connection
      const axios = (await import('axios')).default
      const modelUrl = process.env.MODEL_URL || 'http://10.4.0.15:11434'
      
      const tests = {
        ollamaConnection: false,
        modelAvailable: false,
        databaseAccess: false,
        storageAccess: false
      }
      
      // Test 1: Ollama connection
      try {
        const response = await axios.get(`${modelUrl}/api/tags`, { timeout: 5000 })
        tests.ollamaConnection = true
        
        // Test 2: Check if our model is available
        const modelName = process.env.MODEL_NAME || 'benhaotang/Nanonets-OCR-s:latest'
        if (response.data.models && response.data.models.some(m => m.name.includes(modelName.split(':')[0]))) {
          tests.modelAvailable = true
        }
        
        logSystem('success', 'ProcessingAPI', 'Ollama connection test passed', { 
          modelUrl,
          availableModels: response.data.models?.length || 0
        })
      } catch (error) {
        logSystem('error', 'ProcessingAPI', 'Ollama connection test failed', { 
          modelUrl,
          error: error.message 
        })
      }
      
      // Test 3: Database access
      try {
        const db = getDatabase()
        await new Promise((resolve, reject) => {
          db.get('SELECT COUNT(*) as count FROM jobs', (err, row) => {
            if (err) reject(err)
            else resolve(row)
          })
        })
        tests.databaseAccess = true
        logSystem('success', 'ProcessingAPI', 'Database access test passed')
      } catch (error) {
        logSystem('error', 'ProcessingAPI', 'Database access test failed', { error: error.message })
      }
      
      // Test 4: Storage access
      try {
        const fs = await import('fs-extra')
        const storagePath = path.join(process.cwd(), 'storage')
        await fs.ensureDir(storagePath)
        tests.storageAccess = true
        logSystem('success', 'ProcessingAPI', 'Storage access test passed')
      } catch (error) {
        logSystem('error', 'ProcessingAPI', 'Storage access test failed', { error: error.message })
      }
      
      const allTestsPassed = Object.values(tests).every(test => test === true)
      
      res.json({
        success: allTestsPassed,
        message: allTestsPassed ? 'All tests passed' : 'Some tests failed',
        tests,
        environment: {
          modelUrl: process.env.MODEL_URL || 'http://10.4.0.15:11434',
          modelName: process.env.MODEL_NAME || 'benhaotang/Nanonets-OCR-s:latest',
          storagePath: path.join(process.cwd(), 'storage')
        }
      })
    } catch (error) {
      logSystem('error', 'ProcessingAPI', 'Processing test failed', { error: error.message })
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })
}

// Helper function to get job with image count
function getJobWithImages(db, jobId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT j.*, 
        (SELECT COUNT(*) FROM images WHERE job_id = j.id) as imageCount
      FROM jobs j 
      WHERE j.id = ?
    `, [jobId], (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}