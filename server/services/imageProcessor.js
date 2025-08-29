import sharp from 'sharp'
import path from 'path'
import fs from 'fs-extra'
import crypto from 'crypto'

export class ImageProcessor {
  constructor() {
    this.profiles = {
      simple: { contrast: 1.2, brightness: 1.1 },
      standard: { contrast: 1.5, brightness: 1.2, sharpen: true },
      advanced: { contrast: 1.8, brightness: 1.3, sharpen: true, denoise: true },
      full: { contrast: 2.0, brightness: 1.4, sharpen: true, denoise: true, deskew: true }
    }
    this.settings = {
      enhancement: 'standard',
      targetHeight: 90,
      contrastBoost: 1.5,
      sharpenAmount: 1.0,
      denoiseStrength: 0.5
    }
  }
  
  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings }
    console.log('ImageProcessor settings updated:', this.settings)
  }
  
  async processImage(imageId, settings = {}) {
    const effectiveSettings = { ...this.settings, ...settings }
    const originalPath = path.join(process.cwd(), 'storage', 'originals', imageId.substring(0, 2), imageId)
    
    if (!fs.existsSync(originalPath)) {
      throw new Error('Original image not found')
    }
    
    // Create directories
    const preprocDir = path.join(process.cwd(), 'storage', 'preproc', imageId.substring(0, 2))
    const thumbDir = path.join(process.cwd(), 'storage', 'thumbs', imageId.substring(0, 2))
    
    await fs.ensureDir(preprocDir)
    await fs.ensureDir(thumbDir)
    
    const preprocPath = path.join(preprocDir, imageId + '.webp')
    const thumbPath = path.join(thumbDir, imageId + '.webp')
    
    // Process with configured profile
    const profile = this.profiles[effectiveSettings.enhancement] || this.profiles.standard
    
    let pipeline = sharp(originalPath)
      .resize({ height: effectiveSettings.targetHeight || 90, withoutEnlargement: true })
      .modulate({
        brightness: profile.brightness,
        saturation: 0.5 // Reduce saturation for better OCR
      })
      .linear(effectiveSettings.contrastBoost || profile.contrast, -(128 * (effectiveSettings.contrastBoost || profile.contrast)) + 128)
    
    if (profile.sharpen) {
      pipeline = pipeline.sharpen()
    }
    
    if (profile.denoise) {
      pipeline = pipeline.median(3)
    }
    
    // Save preprocessed image
    await pipeline
      .webp({ quality: 90 })
      .toFile(preprocPath)
    
    // Create thumbnail
    await sharp(originalPath)
      .resize(128, 48, { fit: 'contain', background: '#ffffff' })
      .webp({ quality: 80 })
      .toFile(thumbPath)
    
    // Calculate perceptual hash (simplified)
    const phash = await this.calculatePHash(preprocPath)
    
    return {
      preprocPath,
      thumbPath,
      phash
    }
  }
  
  async calculatePHash(imagePath) {
    // Simplified pHash calculation
    const { data } = await sharp(imagePath)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
    
    // Calculate average
    const avg = data.reduce((sum, val) => sum + val, 0) / data.length
    
    // Create hash
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      if (data[i] > avg) {
        hash |= (1 << i)
      }
    }
    
    return hash.toString(16)
  }
}