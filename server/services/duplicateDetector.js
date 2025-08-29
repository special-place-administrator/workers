import { getDatabase } from '../database/init.js'

export class DuplicateDetector {
  constructor() {
    this.settings = {
      dupPhashThreshold: 10,
      textDistanceThreshold: 0.8,
      autoConfirmDuplicates: false
    }
  }
  
  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings }
    console.log('DuplicateDetector settings updated:', this.settings)
  }
  
  async findDuplicates(imageId, passportNumber) {
    const db = getDatabase()
    
    return new Promise((resolve, reject) => {
      // Find images with same passport number
      db.all(`
        SELECT i.id, i.phash, r.passport_number
        FROM images i
        JOIN results r ON i.id = r.image_id
        WHERE r.passport_number = ? AND i.id != ?
        AND r.version = (SELECT MAX(version) FROM results WHERE image_id = i.id)
      `, [passportNumber, imageId], async (err, rows) => {
        if (err) {
          reject(err)
          return
        }
        
        const duplicates = []
        
        for (const row of rows) {
          // Calculate Hamming distance between pHashes
          const hammingDistance = this.calculateHammingDistance(
            await this.getImagePHash(imageId),
            row.phash
          )
          
          if (hammingDistance <= this.settings.dupPhashThreshold) {
            // Record duplicate
            db.run(`
              INSERT OR IGNORE INTO duplicates (image_id_a, image_id_b, hamming, text_distance)
              VALUES (?, ?, ?, ?)
            `, [imageId, row.id, hammingDistance, 0])
            
            duplicates.push({
              imageId: row.id,
              hammingDistance,
              passportNumber: row.passport_number
            })
          }
        }
        
        resolve(duplicates)
      })
    })
  }
  
  calculateHammingDistance(hash1, hash2) {
    if (!hash1 || !hash2) return 999
    
    const int1 = parseInt(hash1, 16)
    const int2 = parseInt(hash2, 16)
    const xor = int1 ^ int2
    
    // Count set bits
    let count = 0
    let n = xor
    while (n) {
      count += n & 1
      n >>= 1
    }
    
    return count
  }
  
  async getImagePHash(imageId) {
    const db = getDatabase()
    
    return new Promise((resolve, reject) => {
      db.get('SELECT phash FROM images WHERE id = ?', [imageId], (err, row) => {
        if (err) reject(err)
        else resolve(row?.phash)
      })
    })
  }
}