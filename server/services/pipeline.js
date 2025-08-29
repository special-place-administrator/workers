import EventEmitter from 'events'
import { getDatabase } from '../database/init.js'
import { ImageProcessor } from './imageProcessor.js'
import { OCRService } from './ocrService.js'
import { FusionService } from './fusionService.js'
import { DuplicateDetector } from './duplicateDetector.js'

export class ProcessingPipeline extends EventEmitter {
  constructor() {
    super()
    this.queues = {
      preprocess: [],
      ocr: [],
      fusion: [],
      post: []
    }
    this.workers = {
      preprocess: [],
      ocr: [],
      fusion: [],
      post: []
    }
    this.runningJobs = new Set()
    this.pausedJobs = new Set()
    this.settings = {
      preprocessWorkers: 2,
      ocrWorkers: 2,
      ramTargetPct: 60,
      confThreshold: 80,
      modelUrl: 'http://10.4.0.15:11434',
      modelName: 'benhaotang/Nanonets-OCR-s:latest',
      enhancement: 'standard',
      patternRegex: '^(?:(?:[CDES][0-9]{8})|(?:[CDESN]{2}[0-9]{7}))$',
      forceParseIndex: false,
      parseIndex: 0
    }
    
    this.imageProcessor = new ImageProcessor()
    this.ocrService = new OCRService()
    this.fusionService = new FusionService()
    this.duplicateDetector = new DuplicateDetector()
    
    this.loadSettings().then(() => {
      this.initWorkers()
    })
  }

  async loadSettings() {
    const db = getDatabase()
    
    return new Promise((resolve) => {
      db.all('SELECT key, value FROM settings', (err, rows) => {
        if (err) {
          console.warn('Could not load settings, using defaults')
          resolve()
          return
        }
        
        rows.forEach(row => {
          try {
            this.settings[row.key] = JSON.parse(row.value)
          } catch {
            this.settings[row.key] = row.value
          }
        })
        
        // Update services with new settings
        this.updateServices()
        resolve()
      })
    })
  }

  updateSettings(newSettings) {
    const oldSettings = { ...this.settings }
    this.settings = { ...this.settings, ...newSettings }
    
    // Restart workers if worker counts changed
    if (oldSettings.preprocessWorkers !== this.settings.preprocessWorkers ||
        oldSettings.ocrWorkers !== this.settings.ocrWorkers) {
      this.restartWorkers()
    }
    
    // Update services
    this.updateServices()
  }

  updateServices() {
    // FIXED: Properly call updateSettings on all services
    if (this.imageProcessor && typeof this.imageProcessor.updateSettings === 'function') {
      this.imageProcessor.updateSettings(this.settings)
    }
    
    if (this.ocrService && typeof this.ocrService.updateSettings === 'function') {
      this.ocrService.updateSettings(this.settings)
    }
    
    if (this.fusionService && typeof this.fusionService.updateSettings === 'function') {
      this.fusionService.updateSettings(this.settings)
    }
    
    if (this.duplicateDetector && typeof this.duplicateDetector.updateSettings === 'function') {
      this.duplicateDetector.updateSettings(this.settings)
    }
  }

  restartWorkers() {
    console.log('Restarting workers with new settings...')
    
    // Clear existing workers
    Object.keys(this.workers).forEach(stage => {
      this.workers[stage] = []
    })
    
    // Start new workers
    this.initWorkers()
  }
  
  initWorkers() {
    // Start preprocess workers
    for (let i = 0; i < this.settings.preprocessWorkers; i++) {
      this.startWorker('preprocess')
    }
    
    // Start OCR workers
    for (let i = 0; i < this.settings.ocrWorkers; i++) {
      this.startWorker('ocr')
    }
    
    // Always have 2 fusion and post workers
    for (let i = 0; i < 2; i++) {
      this.startWorker('fusion')
      this.startWorker('post')
    }
  }
  
  startWorker(stage) {
    const worker = {
      id: Math.random().toString(36).substr(2, 9),
      stage,
      busy: false
    }
    
    this.workers[stage].push(worker)
    this.processQueue(stage, worker)
  }
  
  async processQueue(stage, worker) {
    while (true) {
      // Check memory usage
      const memUsage = process.memoryUsage()
      const memPercent = (memUsage.rss / (1024 * 1024 * 1024)) * 100
      
      if (memPercent > this.settings.ramTargetPct) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        continue
      }
      
      if (this.queues[stage].length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      
      const task = this.queues[stage].shift()
      if (!task) continue
      
      // Check if job is paused or stopped
      if (this.pausedJobs.has(task.jobId) || !this.runningJobs.has(task.jobId)) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        this.queues[stage].unshift(task) // Put back at front
        continue
      }
      
      worker.busy = true
      
      try {
        await this.processTask(stage, task)
      } catch (error) {
        console.error(`Error processing ${stage} task:`, error)
        await this.handleTaskError(task, error)
      }
      
      worker.busy = false
    }
  }
  
  async processTask(stage, task) {
    switch (stage) {
      case 'preprocess':
        await this.preprocessImage(task)
        break
      case 'ocr':
        await this.performOCR(task)
        break
      case 'fusion':
        await this.fuseResults(task)
        break
      case 'post':
        await this.postProcess(task)
        break
    }
  }
  
  async preprocessImage(task) {
    const { imageId, jobId } = task
    
    try {
      const result = await this.imageProcessor.processImage(imageId, this.settings)
      
      // Update image record
      const db = getDatabase()
      db.run(`
        UPDATE images 
        SET preproc_path = ?, thumb_path = ?, phash = ?
        WHERE id = ?
      `, [result.preprocPath, result.thumbPath, result.phash, imageId])
      
      // Queue for OCR
      this.queues.ocr.push({ imageId, jobId, preprocPath: result.preprocPath })
      
    } catch (error) {
      throw new Error(`Preprocessing failed: ${error.message}`)
    }
  }
  
  async performOCR(task) {
    const { imageId, jobId, preprocPath } = task
    
    try {
      const results = await this.ocrService.processImage(preprocPath, this.settings)
      
      // Queue for fusion
      this.queues.fusion.push({ imageId, jobId, ocrResults: results })
      
    } catch (error) {
      throw new Error(`OCR failed: ${error.message}`)
    }
  }
  
  async fuseResults(task) {
    const { imageId, jobId, ocrResults } = task
    
    try {
      // Use enhanced fusion service
      const fusedResult = this.fusionService.fuseOCRResults(ocrResults, this.settings)
      
      // Save result to database with enhanced character data
      const db = getDatabase()
      db.run(`
        INSERT INTO results (
          image_id, job_id, passport_number, per_char_conf, per_char_src,
          confidence, status, reasons, raw_response, enhancement_profile, 
          damage_flags, fusion_method, sources_used, valid_positions, ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        imageId,
        jobId,
        fusedResult.passport_number,
        JSON.stringify(fusedResult.per_char_conf),
        JSON.stringify(fusedResult.per_char_src),
        fusedResult.confidence,
        fusedResult.status || 'PROCESSING',
        fusedResult.reasons,
        JSON.stringify(ocrResults),
        this.settings.enhancement,
        JSON.stringify(fusedResult.damage_flags),
        fusedResult.fusion_method,
        JSON.stringify(fusedResult.sources_used),
        fusedResult.valid_positions
      ])
      
      // Queue for post-processing
      this.queues.post.push({ imageId, jobId, result: fusedResult })
      
    } catch (error) {
      throw new Error(`Fusion failed: ${error.message}`)
    }
  }
  
  async postProcess(task) {
    const { imageId, jobId, result } = task
    
    try {
      let status = result.status
      
      // Check for duplicates only if status is SUCCESS
      if (status === 'SUCCESS') {
        const duplicates = await this.duplicateDetector.findDuplicates(imageId, result.passport_number)
        if (duplicates.length > 0) {
          status = 'DUPLICATE_NUMBER'
        }
      }
      
      // Update result status
      const db = getDatabase()
      db.run(`
        UPDATE results 
        SET status = ?, completion_time = CURRENT_TIMESTAMP
        WHERE image_id = ? AND version = (
          SELECT MAX(version) FROM results WHERE image_id = ?
        )
      `, [status, imageId, imageId])
      
      this.emit('imageProcessed', { imageId, jobId, status, result })
      
    } catch (error) {
      throw new Error(`Post-processing failed: ${error.message}`)
    }
  }
  
  startJob(jobId) {
    this.runningJobs.add(jobId)
    this.pausedJobs.delete(jobId)
    
    // Queue all images for processing
    const db = getDatabase()
    db.all('SELECT id FROM images WHERE job_id = ?', [jobId], (err, rows) => {
      if (err) {
        console.error('Error queuing job images:', err)
        return
      }
      
      rows.forEach(row => {
        this.queues.preprocess.push({ imageId: row.id, jobId })
      })
    })
  }
  
  pauseJob(jobId) {
    this.pausedJobs.add(jobId)
  }
  
  stopJob(jobId) {
    this.runningJobs.delete(jobId)
    this.pausedJobs.delete(jobId)
    
    // Remove pending tasks for this job
    Object.keys(this.queues).forEach(stage => {
      this.queues[stage] = this.queues[stage].filter(task => task.jobId !== jobId)
    })
  }
  
  reprocessImage(imageId, options) {
    console.log(`Reprocessing image ${imageId} with options:`, options)
    
    // Queue image for reprocessing with new settings
    const tempSettings = { ...this.settings, ...options }
    this.queues.preprocess.push({ 
      imageId, 
      jobId: null, 
      reprocess: true, 
      settings: tempSettings 
    })
  }
  
  async handleTaskError(task, error) {
    const db = getDatabase()
    db.run(`
      INSERT INTO results (
        image_id, job_id, status, reasons, ts
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [task.imageId, task.jobId, 'ERROR', error.message])
  }

  getQueueMetrics() {
    return {
      preprocess: this.queues.preprocess.length,
      ocr: this.queues.ocr.length,
      fusion: this.queues.fusion.length,
      post: this.queues.post.length
    }
  }

  getWorkerMetrics() {
    const metrics = {}
    Object.keys(this.workers).forEach(stage => {
      const workers = this.workers[stage]
      metrics[stage] = {
        total: workers.length,
        busy: workers.filter(w => w.busy).length,
        idle: workers.filter(w => !w.busy).length
      }
    })
    return metrics
  }
}