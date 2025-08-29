import EventEmitter from 'events'
import axios from 'axios'
import sharp from 'sharp'
import fs from 'fs-extra'
import path from 'path'
import { getDatabase } from '../database/init.js'
import { logSystem } from './SystemLogger.js'

export class ProcessingPipeline extends EventEmitter {
  constructor() {
    super()
    this.isProcessing = false
    this.currentJob = null
    this.processedCount = 0
    this.totalCount = 0
    this.abortController = null
    this.batchSize = 5 // Process 5 images at a time
    
    // Model configuration from environment
    this.modelUrl = process.env.MODEL_URL || 'http://10.4.0.15:11434'
    this.modelName = process.env.MODEL_NAME || 'benhaotang/Nanonets-OCR-s:latest'
    this.visionPrompt = process.env.VISION_PROMPT || 'Extract the passport number from this image. Return only JSON: {"passport_number": "C12345678", "confidence": 85}'
    this.patternRegex = new RegExp(process.env.PATTERN_REGEX || '^(?:(?:[CDES][0-9]{8})|(?:[CDESN]{2}[0-9]{7}))$')
    this.confThreshold = parseInt(process.env.CONF_THRESHOLD) || 80
    
    logSystem('info', 'ProcessingPipeline', 'Pipeline initialized', {
      modelUrl: this.modelUrl,
      modelName: this.modelName,
      confThreshold: this.confThreshold
    })
  }

  async startJob(jobId) {
    if (this.isProcessing) {
      logSystem('warn', 'ProcessingPipeline', 'Already processing, ignoring start request', { currentJob: this.currentJob })
      return false
    }

    try {
      const db = getDatabase()
      
      // Get job details
      const job = await this.getJob(db, jobId)
      if (!job) {
        logSystem('error', 'ProcessingPipeline', 'Job not found', { jobId })
        return false
      }

      // Get pending images
      const images = await this.getPendingImages(db, jobId)
      if (images.length === 0) {
        logSystem('info', 'ProcessingPipeline', 'No pending images found', { jobId })
        return false
      }

      this.isProcessing = true
      this.currentJob = jobId
      this.processedCount = 0
      this.totalCount = images.length
      this.abortController = new AbortController()

      logSystem('info', 'ProcessingPipeline', 'Starting job processing', {
        jobId,
        jobName: job.name,
        imageCount: images.length
      })

      this.emit('jobStarted', { jobId, totalImages: images.length })

      // Update job status
      await this.updateJobStatus(db, jobId, 'PROCESSING')

      // Process images in batches
      for (let i = 0; i < images.length; i += this.batchSize) {
        if (this.abortController.signal.aborted) {
          logSystem('info', 'ProcessingPipeline', 'Processing aborted by user')
          break
        }

        const batch = images.slice(i, i + this.batchSize)
        await this.processBatch(batch)

        // Emit progress update
        this.emit('progress', {
          jobId,
          processed: this.processedCount,
          total: this.totalCount,
          percentage: Math.round((this.processedCount / this.totalCount) * 100)
        })
      }

      // Final status update
      if (!this.abortController.signal.aborted) {
        await this.updateJobStatus(db, jobId, 'COMPLETED')
        logSystem('success', 'ProcessingPipeline', 'Job processing completed', {
          jobId,
          processed: this.processedCount,
          total: this.totalCount
        })
      } else {
        await this.updateJobStatus(db, jobId, 'PAUSED')
        logSystem('info', 'ProcessingPipeline', 'Job processing paused', { jobId })
      }

      this.emit('jobCompleted', { jobId, processed: this.processedCount, total: this.totalCount })

    } catch (error) {
      logSystem('error', 'ProcessingPipeline', 'Job processing failed', { jobId, error: error.message })
      await this.updateJobStatus(getDatabase(), jobId, 'ERROR')
      this.emit('jobError', { jobId, error: error.message })
    } finally {
      this.isProcessing = false
      this.currentJob = null
      this.abortController = null
    }

    return true
  }

  async pauseJob() {
    if (this.abortController) {
      this.abortController.abort()
      logSystem('info', 'ProcessingPipeline', 'Processing pause requested')
    }
  }

  async stopJob() {
    if (this.abortController) {
      this.abortController.abort()
      logSystem('info', 'ProcessingPipeline', 'Processing stop requested')
    }
  }

  async processBatch(images) {
    const promises = images.map(image => this.processImage(image))
    await Promise.allSettled(promises)
  }

  async processImage(image) {
    const startTime = Date.now()
    logSystem('info', 'ProcessingPipeline', 'Processing image', { 
      imageId: image.id, 
      filename: image.filename 
    })

    try {
      // Prepare image for OCR
      const imageBuffer = await this.prepareImage(image.original_path)
      
      // Call Ollama vision model
      const ocrResult = await this.callOllamaVision(imageBuffer, image.filename)
      
      // Validate and process result
      const processedResult = await this.processOCRResult(ocrResult, image)
      
      // Save result to database
      await this.saveResult(image.id, processedResult)
      
      this.processedCount++
      
      const processingTime = Date.now() - startTime
      logSystem('success', 'ProcessingPipeline', 'Image processed successfully', {
        imageId: image.id,
        filename: image.filename,
        result: processedResult.passport_number,
        confidence: processedResult.confidence,
        processingTime: `${processingTime}ms`
      })

      this.emit('imageProcessed', {
        imageId: image.id,
        filename: image.filename,
        result: processedResult
      })

    } catch (error) {
      logSystem('error', 'ProcessingPipeline', 'Image processing failed', {
        imageId: image.id,
        filename: image.filename,
        error: error.message
      })

      await this.saveResult(image.id, {
        passport_number: null,
        confidence: 0,
        status: 'ERROR',
        error: error.message,
        per_char_conf: Array(9).fill(0)
      })

      this.processedCount++
    }
  }

  async prepareImage(imagePath) {
    try {
      // Load and optionally preprocess image
      const buffer = await sharp(imagePath)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer()
      
      return buffer
    } catch (error) {
      logSystem('error', 'ProcessingPipeline', 'Image preparation failed', { imagePath, error: error.message })
      throw new Error(`Failed to prepare image: ${error.message}`)
    }
  }

  async callOllamaVision(imageBuffer, filename) {
    try {
      logSystem('info', 'ProcessingPipeline', 'Calling Ollama vision model', { 
        filename,
        modelUrl: this.modelUrl,
        modelName: this.modelName
      })

      const base64Image = imageBuffer.toString('base64')
      
      const response = await axios.post(`${this.modelUrl}/api/generate`, {
        model: this.modelName,
        prompt: this.visionPrompt,
        images: [base64Image],
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9
        }
      }, {
        timeout: 60000, // 60 second timeout
        signal: this.abortController?.signal
      })

      if (response.data && response.data.response) {
        logSystem('info', 'ProcessingPipeline', 'Ollama response received', { 
          filename,
          responseLength: response.data.response.length
        })
        return response.data.response
      } else {
        throw new Error('Invalid response from Ollama')
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Processing was cancelled')
      }
      
      logSystem('error', 'ProcessingPipeline', 'Ollama API call failed', { 
        filename,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      })
      
      throw new Error(`Ollama API call failed: ${error.message}`)
    }
  }

  async processOCRResult(rawResponse, image) {
    try {
      // Try to parse JSON response
      let parsedResponse
      
      // Clean up the response - sometimes Ollama returns extra text
      const jsonMatch = rawResponse.match(/\{[^}]*\}/)
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0])
      } else {
        // Fallback: try to extract passport number with regex
        const passportMatch = rawResponse.match(/([CDESN]{1,2}\d{7,8})/i)
        if (passportMatch) {
          parsedResponse = {
            passport_number: passportMatch[1].toUpperCase(),
            confidence: 50 // Lower confidence for regex extraction
          }
        } else {
          throw new Error('No passport number found in response')
        }
      }

      const passportNumber = parsedResponse.passport_number
      const confidence = parsedResponse.confidence || 0

      // Validate passport number format
      const isValidFormat = this.patternRegex.test(passportNumber)
      
      // Determine status
      let status = 'SUCCESS'
      let reasons = []

      if (!isValidFormat) {
        status = 'REVIEW_REQUIRED'
        reasons.push('Invalid passport number format')
      }

      if (confidence < this.confThreshold) {
        status = 'REVIEW_REQUIRED'
        reasons.push(`Low confidence: ${confidence}% < ${this.confThreshold}%`)
      }

      // Generate per-character confidence (mock for now)
      const perCharConf = Array(9).fill(confidence).map(() => 
        Math.max(0, confidence + (Math.random() - 0.5) * 20)
      )

      return {
        passport_number: passportNumber,
        confidence: confidence,
        status: status,
        per_char_conf: perCharConf,
        reasons: reasons.join('; '),
        raw_response: rawResponse,
        format_valid: isValidFormat
      }

    } catch (error) {
      logSystem('error', 'ProcessingPipeline', 'OCR result processing failed', { 
        imageId: image.id,
        rawResponse: rawResponse.substring(0, 200),
        error: error.message
      })

      return {
        passport_number: null,
        confidence: 0,
        status: 'ERROR',
        per_char_conf: Array(9).fill(0),
        reasons: `Processing error: ${error.message}`,
        raw_response: rawResponse,
        format_valid: false
      }
    }
  }

  async saveResult(imageId, result) {
    const db = getDatabase()
    
    return new Promise((resolve, reject) => {
      // First, get the current max version for this image
      db.get('SELECT MAX(version) as max_version FROM results WHERE image_id = ?', [imageId], (err, row) => {
        if (err) {
          reject(err)
          return
        }

        const version = (row?.max_version || 0) + 1

        db.run(`
          INSERT INTO results (
            image_id, version, passport_number, confidence, status,
            per_char_conf, reasons, raw_response, format_valid, created_ts
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          imageId,
          version,
          result.passport_number,
          result.confidence,
          result.status,
          JSON.stringify(result.per_char_conf),
          result.reasons,
          result.raw_response,
          result.format_valid ? 1 : 0
        ], function(err) {
          if (err) {
            reject(err)
          } else {
            resolve(this.lastID)
          }
        })
      })
    })
  }

  // Helper methods
  async getJob(db, jobId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM jobs WHERE id = ?', [jobId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  async getPendingImages(db, jobId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT i.* FROM images i
        LEFT JOIN results r ON i.id = r.image_id
        WHERE i.job_id = ? AND r.image_id IS NULL
        ORDER BY i.upload_ts ASC
      `, [jobId], (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }

  async updateJobStatus(db, jobId, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE jobs SET status = ?, updated_ts = CURRENT_TIMESTAMP WHERE id = ?',
        [status, jobId],
        function(err) {
          if (err) reject(err)
          else resolve(this.changes)
        }
      )
    })
  }

  getStatus() {
    return {
      isProcessing: this.isProcessing,
      currentJob: this.currentJob,
      processedCount: this.processedCount,
      totalCount: this.totalCount,
      percentage: this.totalCount > 0 ? Math.round((this.processedCount / this.totalCount) * 100) : 0
    }
  }
}