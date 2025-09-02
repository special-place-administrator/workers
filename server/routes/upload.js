import multer from 'multer'
import path from 'path'
import fs from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'
import AdmZip from 'adm-zip'
import sharp from 'sharp'
import { getDatabase } from '../database/init.js'

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'temp', 'uploads')
    fs.ensureDirSync(uploadDir)
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept ZIP files, common image formats, and PDFs
    const allowedMimes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/bmp',
      'image/tiff',
      'image/tif'
    ]

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      // Check file extension as fallback
      const ext = path.extname(file.originalname).toLowerCase()
      const validExtensions = ['.zip', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.pdf']

      if (validExtensions.includes(ext)) {
        cb(null, true)
      } else {
        cb(new Error('Invalid file type. Only ZIP, image, or PDF files are allowed.'))
      }
    }
  }
})

export const setupUploadRoutes = (router, services) => {
  // Get current validation settings
  router.get('/upload/settings', (req, res) => {
    const db = getDatabase()
    
    db.all('SELECT key, value FROM settings WHERE key LIKE "upload_%"', (err, rows) => {
      if (err) {
        console.error('Error fetching upload settings:', err)
        return res.status(500).json({ error: 'Failed to fetch settings' })
      }
      
      const settings = {}
      rows.forEach(row => {
        try {
          settings[row.key] = JSON.parse(row.value)
        } catch {
          settings[row.key] = row.value
        }
      })
      
      // Provide intelligent defaults based on expected parameters
      const defaultSettings = {
        // Expected image parameters
        upload_expected_width: 200,
        upload_expected_height: 500,
        upload_expected_file_size: 3072, // 3KB in bytes
        
        // Tolerance percentages
        upload_dimension_tolerance: 20, // 20% tolerance for dimensions
        upload_file_size_tolerance: 25, // 25% tolerance for file size  
        upload_aspect_ratio_tolerance: 15, // 15% tolerance for aspect ratio
        
        // Absolute safety limits
        upload_min_file_size: 512, // 512 bytes minimum
        upload_max_file_size: 10485760, // 10MB maximum
        upload_min_dimension: 10, // 10px minimum
        upload_max_dimension: 5000, // 5000px maximum
      }
      
      res.json({ ...defaultSettings, ...settings })
    })
  })

  // Update validation settings
  router.post('/upload/settings', (req, res) => {
    const db = getDatabase()
    const newSettings = req.body
    
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_ts) VALUES (?, ?, CURRENT_TIMESTAMP)')
    
    try {
      for (const [key, value] of Object.entries(newSettings)) {
        if (key.startsWith('upload_')) {
          stmt.run(key, JSON.stringify(value))
        }
      }
      
      stmt.finalize((err) => {
        if (err) {
          console.error('Error saving upload settings:', err)
          return res.status(500).json({ error: 'Failed to save settings' })
        }
        
        res.json({ success: true, message: 'Upload settings saved successfully' })
      })
    } catch (error) {
      console.error('Error processing upload settings:', error)
      res.status(500).json({ error: 'Failed to process settings' })
    }
  })

  // Upload files (ZIP or images)
  router.post('/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No file uploaded' 
        })
      }

      const { jobId, uploadType } = req.body
      if (!jobId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Job ID is required' 
        })
      }

      console.log(`Processing upload for job ${jobId}: ${req.file.originalname} (${uploadType})`)

      // Get current validation settings
      const validationSettings = await getValidationSettings()
      
      let imageFiles = []
      
      if (uploadType === 'zip' || req.file.mimetype.includes('zip')) {
        // ZIP file - extract images intelligently
        imageFiles = await extractImagesFromZipIntelligently(req.file.path, validationSettings)
      } else {
        // Single image file - validate using intelligent parameters
        const validation = await validateImageIntelligently(req.file.path, req.file.originalname, validationSettings)
        if (validation.valid) {
          imageFiles = [{
            filename: req.file.originalname,
            path: req.file.path,
            buffer: fs.readFileSync(req.file.path),
            validation: validation
          }]
        } else {
          return res.status(400).json({ 
            success: false, 
            error: `Image validation failed: ${validation.reason}` 
          })
        }
      }

      if (imageFiles.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No valid passport images found in the uploaded file' 
        })
      }

      // Process and store images
      const results = await processUploadedImages(imageFiles, jobId)

      // Clean up temp files
      await fs.remove(req.file.path)
      for (const file of imageFiles) {
        if (file.tempPath && fs.existsSync(file.tempPath)) {
          await fs.remove(file.tempPath)
        }
      }

      res.json({
        success: true,
        message: `Successfully processed ${results.successful} images from ${req.file.originalname}`,
        stats: results
      })

    } catch (error) {
      console.error('Upload error:', error)
      
      // Clean up on error
      if (req.file && fs.existsSync(req.file.path)) {
        await fs.remove(req.file.path)
      }

      res.status(500).json({ 
        success: false, 
        error: error.message || 'Upload processing failed' 
      })
    }
  })

  // Get upload progress (for future enhancement)
  router.get('/upload/progress/:jobId', (req, res) => {
    const { jobId } = req.params
    
    res.json({
      jobId,
      progress: 100,
      status: 'completed'
    })
  })
}

async function getValidationSettings() {
  const db = getDatabase()
  
  return new Promise((resolve) => {
    db.all('SELECT key, value FROM settings WHERE key LIKE "upload_%"', (err, rows) => {
      if (err) {
        console.error('Error fetching validation settings:', err)
        // Return intelligent defaults on error
        resolve({
          upload_expected_width: 200,
          upload_expected_height: 500,
          upload_expected_file_size: 3072,
          upload_dimension_tolerance: 20,
          upload_file_size_tolerance: 25,
          upload_aspect_ratio_tolerance: 15,
          upload_min_file_size: 512,
          upload_max_file_size: 10485760,
          upload_min_dimension: 10,
          upload_max_dimension: 5000
        })
        return
      }
      
      const settings = {}
      rows.forEach(row => {
        try {
          settings[row.key] = JSON.parse(row.value)
        } catch {
          settings[row.key] = row.value
        }
      })
      
      // Merge with intelligent defaults
      const defaultSettings = {
        upload_expected_width: 200,
        upload_expected_height: 500,
        upload_expected_file_size: 3072,
        upload_dimension_tolerance: 20,
        upload_file_size_tolerance: 25,
        upload_aspect_ratio_tolerance: 15,
        upload_min_file_size: 512,
        upload_max_file_size: 10485760,
        upload_min_dimension: 10,
        upload_max_dimension: 5000
      }
      
      resolve({ ...defaultSettings, ...settings })
    })
  })
}

async function extractImagesFromZipIntelligently(zipPath, validationSettings) {
  const imageFiles = []
  
  try {
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()

    console.log(`Extracting from ZIP: found ${entries.length} entries`)

    for (const entry of entries) {
      if (entry.isDirectory) continue

      const filename = entry.entryName
      const ext = path.extname(filename).toLowerCase()
      
      // Check if it's an image file
      if (['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'].includes(ext)) {
        try {
          const buffer = entry.getData()
          
          if (buffer && buffer.length > 0) {
            // Validate using intelligent parameters
            const tempPath = path.join(process.cwd(), 'temp', `extract_${Date.now()}_${path.basename(filename)}`)
            await fs.writeFile(tempPath, buffer)
            
            const validation = await validateImageIntelligently(tempPath, filename, validationSettings)
            
            if (validation.valid) {
              imageFiles.push({
                filename: path.basename(filename),
                path: filename,
                buffer: buffer,
                tempPath: tempPath,
                validation: validation
              })
              console.log(`✓ Valid image: ${filename} (${(buffer.length / 1024).toFixed(1)}KB, ${validation.metadata.width}×${validation.metadata.height})`)
            } else {
              console.log(`✗ Rejected ${filename}: ${validation.reason}`)
              await fs.remove(tempPath)
            }
          }
        } catch (err) {
          console.warn(`Failed to extract ${filename}:`, err.message)
        }
      } else {
        console.log(`ℹ Ignored non-image file: ${filename}`)
      }
    }
  } catch (error) {
    throw new Error(`Failed to extract ZIP file: ${error.message}`)
  }

  console.log(`Extraction complete: ${imageFiles.length} valid images found`)
  return imageFiles
}

async function validateImageIntelligently(imagePath, filename, settings) {
  try {
    // Check file exists and has content
    const stats = await fs.stat(imagePath)
    if (stats.size === 0) {
      return { valid: false, reason: 'Empty file' }
    }

    // Calculate dynamic bounds based on expected values and tolerances
    const expectedWidth = settings.upload_expected_width || 200
    const expectedHeight = settings.upload_expected_height || 500
    const expectedFileSize = settings.upload_expected_file_size || 3072
    const dimensionTolerance = (settings.upload_dimension_tolerance || 20) / 100
    const fileSizeTolerance = (settings.upload_file_size_tolerance || 25) / 100
    const aspectRatioTolerance = (settings.upload_aspect_ratio_tolerance || 15) / 100

    // Check file size using intelligent bounds
    const minFileSize = Math.max(settings.upload_min_file_size || 512, Math.round(expectedFileSize * (1 - fileSizeTolerance)))
    const maxFileSize = Math.min(settings.upload_max_file_size || 10485760, Math.round(expectedFileSize * (1 + fileSizeTolerance)))
    
    if (stats.size < minFileSize) {
      return { 
        valid: false, 
        reason: `File too small (${(stats.size / 1024).toFixed(1)}KB < ${(minFileSize / 1024).toFixed(1)}KB expected range)` 
      }
    }

    if (stats.size > maxFileSize) {
      return { 
        valid: false, 
        reason: `File too large (${(stats.size / 1024).toFixed(1)}KB > ${(maxFileSize / 1024).toFixed(1)}KB expected range)` 
      }
    }

    // Use Sharp to validate and get image metadata
    const metadata = await sharp(imagePath).metadata()
    
    if (!metadata.width || !metadata.height) {
      return { valid: false, reason: 'Invalid image format or corrupt file' }
    }

    // Check intelligent dimension bounds
    const minWidth = Math.max(settings.upload_min_dimension || 10, Math.round(expectedWidth * (1 - dimensionTolerance)))
    const maxWidth = Math.min(settings.upload_max_dimension || 5000, Math.round(expectedWidth * (1 + dimensionTolerance)))
    const minHeight = Math.max(settings.upload_min_dimension || 10, Math.round(expectedHeight * (1 - dimensionTolerance)))
    const maxHeight = Math.min(settings.upload_max_dimension || 5000, Math.round(expectedHeight * (1 + dimensionTolerance)))
    
    if (metadata.width < minWidth || metadata.width > maxWidth) {
      return { 
        valid: false, 
        reason: `Width ${metadata.width}px outside expected range (${minWidth}-${maxWidth}px)` 
      }
    }

    if (metadata.height < minHeight || metadata.height > maxHeight) {
      return { 
        valid: false, 
        reason: `Height ${metadata.height}px outside expected range (${minHeight}-${maxHeight}px)` 
      }
    }

    // Intelligent aspect ratio validation
    const expectedAspectRatio = expectedWidth / expectedHeight
    const imageAspectRatio = metadata.width / metadata.height
    const minAspectRatio = expectedAspectRatio * (1 - aspectRatioTolerance)
    const maxAspectRatio = expectedAspectRatio * (1 + aspectRatioTolerance)
    
    if (imageAspectRatio < minAspectRatio || imageAspectRatio > maxAspectRatio) {
      return { 
        valid: false, 
        reason: `Aspect ratio ${imageAspectRatio.toFixed(2)} doesn't match expected ${expectedAspectRatio.toFixed(2)} (±${(aspectRatioTolerance * 100).toFixed(0)}%)` 
      }
    }

    // Check supported formats
    const supportedFormats = ['jpeg', 'png', 'tiff', 'bmp']
    if (!supportedFormats.includes(metadata.format)) {
      return { 
        valid: false, 
        reason: `Unsupported format: ${metadata.format}` 
      }
    }

    return { 
      valid: true, 
      reason: 'Valid image within expected parameters',
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: stats.size,
        aspectRatio: imageAspectRatio,
        expectedAspectRatio: expectedAspectRatio,
        tolerance: {
          dimension: dimensionTolerance,
          fileSize: fileSizeTolerance,
          aspectRatio: aspectRatioTolerance
        }
      }
    }

  } catch (error) {
    return { 
      valid: false, 
      reason: `Image validation error: ${error.message}` 
    }
  }
}

async function processUploadedImages(imageFiles, jobId) {
  const db = getDatabase()
  const results = {
    successful: 0,
    failed: 0,
    duplicates: 0,
    skipped: 0,
    errors: []
  }

  for (const imageFile of imageFiles) {
    try {
      const imageId = uuidv4()
      const fileExtension = path.extname(imageFile.filename).toLowerCase()
      const sanitizedFilename = imageFile.filename.replace(/[^a-zA-Z0-9.-]/g, '_')
      
      // Create directory structure
      const subDir = imageId.substring(0, 2)
      const originalDir = path.join(process.cwd(), 'storage', 'originals', subDir)
      await fs.ensureDir(originalDir)
      
      // Save original image
      const originalPath = path.join(originalDir, imageId + fileExtension)
      await fs.writeFile(originalPath, imageFile.buffer)

      // Check for duplicates (basic filename and size check)
      const existingImage = await checkForExistingImage(db, sanitizedFilename, jobId, imageFile.buffer.length)
      if (existingImage) {
        results.duplicates++
        await fs.remove(originalPath)
        console.log(`Duplicate detected: ${sanitizedFilename}`)
        continue
      }

      // Insert into database with validation metadata
      await insertImageRecord(db, {
        id: imageId,
        jobId: jobId,
        filename: sanitizedFilename,
        originalPath: originalPath,
        fileSize: imageFile.buffer.length,
        uploadTime: new Date().toISOString(),
        metadata: imageFile.validation?.metadata
      })

      results.successful++
      console.log(`Successfully processed: ${imageFile.filename} -> ${imageId}`)

    } catch (error) {
      results.failed++
      results.errors.push(`Failed to process ${imageFile.filename}: ${error.message}`)
      console.error(`Error processing ${imageFile.filename}:`, error)
    }
  }

  // Update job image count
  if (results.successful > 0) {
    await updateJobImageCount(db, jobId)
  }

  return results
}

function checkForExistingImage(db, filename, jobId, fileSize) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM images WHERE filename = ? AND job_id = ? AND file_size = ?',
      [filename, jobId, fileSize],
      (err, row) => {
        if (err) reject(err)
        else resolve(row)
      }
    )
  })
}

function insertImageRecord(db, imageData) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO images (
        id, job_id, filename, original_path, file_size, 
        upload_ts, status, created_ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      imageData.id,
      imageData.jobId,
      imageData.filename,
      imageData.originalPath,
      imageData.fileSize,
      imageData.uploadTime,
      'UPLOADED'
    ], function(err) {
      if (err) reject(err)
      else resolve(this.lastID)
    })
  })
}

function updateJobImageCount(db, jobId) {
  return new Promise((resolve, reject) => {
    db.run(`
      UPDATE jobs 
      SET image_count = (
        SELECT COUNT(*) FROM images WHERE job_id = ?
      ),
      updated_ts = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [jobId, jobId], function(err) {
      if (err) reject(err)
      else resolve(this.changes)
    })
  })
}