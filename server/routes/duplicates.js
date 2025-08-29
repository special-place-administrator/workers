import { getDatabase } from '../database/init.js'

export const setupDuplicateRoutes = (router, services) => {
  // Get duplicates for image
  router.get('/duplicates/:imageId', (req, res) => {
    const { imageId } = req.params
    const db = getDatabase()
    
    db.all(`
      SELECT d.*, i1.filename as filename_a, i2.filename as filename_b,
             r1.passport_number as passport_a, r2.passport_number as passport_b
      FROM duplicates d
      JOIN images i1 ON d.image_id_a = i1.id
      JOIN images i2 ON d.image_id_b = i2.id
      LEFT JOIN results r1 ON i1.id = r1.image_id AND r1.version = (
        SELECT MAX(version) FROM results WHERE image_id = i1.id
      )
      LEFT JOIN results r2 ON i2.id = r2.image_id AND r2.version = (
        SELECT MAX(version) FROM results WHERE image_id = i2.id
      )
      WHERE d.image_id_a = ? OR d.image_id_b = ?
      ORDER BY d.hamming ASC
    `, [imageId, imageId], (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      res.json(rows)
    })
  })
  
  // Confirm duplicate
  router.post('/duplicates/:imageId/confirm', (req, res) => {
    const { imageId } = req.params
    const db = getDatabase()
    
    db.run(`
      UPDATE duplicates 
      SET confirmed = TRUE 
      WHERE image_id_a = ? OR image_id_b = ?
    `, [imageId, imageId], (err) => {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      // Update result status
      db.run(`
        UPDATE results 
        SET status = 'DUPLICATE_CONFIRMED'
        WHERE image_id = ? AND version = (
          SELECT MAX(version) FROM results WHERE image_id = ?
        )
      `, [imageId, imageId])
      
      res.json({ success: true })
    })
  })
  
  // Reject duplicate
  router.post('/duplicates/:imageId/reject', (req, res) => {
    const { imageId } = req.params
    const db = getDatabase()
    
    db.run(`
      DELETE FROM duplicates 
      WHERE image_id_a = ? OR image_id_b = ?
    `, [imageId, imageId], (err) => {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      res.json({ success: true })
    })
  })
}