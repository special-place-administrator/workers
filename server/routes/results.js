import { getDatabase } from '../database/init.js'

export const setupResultRoutes = (router, services) => {
  // Get result for image
  router.get('/results/:imageId', (req, res) => {
    const { imageId } = req.params
    const { version = 'latest' } = req.query
    
    const db = getDatabase()
    
    let query = 'SELECT * FROM results WHERE image_id = ?'
    const params = [imageId]
    
    if (version === 'latest') {
      query += ' ORDER BY version DESC LIMIT 1'
    } else {
      query += ' AND version = ?'
      params.push(parseInt(version))
    }
    
    db.get(query, params, (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      if (!row) {
        res.status(404).json({ error: 'Result not found' })
        return
      }
      
      // Parse JSON fields
      const result = {
        ...row,
        per_char_conf: row.per_char_conf ? JSON.parse(row.per_char_conf) : null,
        per_char_src: row.per_char_src ? JSON.parse(row.per_char_src) : null,
        raw_response: row.raw_response ? JSON.parse(row.raw_response) : null
      }
      
      res.json(result)
    })
  })
  
  // Save correction
  router.post('/results/:imageId/correct', (req, res) => {
    const { imageId } = req.params
    const { passport_number, per_char_edits } = req.body
    
    const db = getDatabase()
    
    // Get current result
    db.get('SELECT * FROM results WHERE image_id = ? ORDER BY version DESC LIMIT 1', [imageId], (err, currentResult) => {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      // Create new version with correction
      const newVersion = (currentResult?.version || 0) + 1
      
      db.run(`
        INSERT INTO results (
          image_id, job_id, version, model_id, passport_number, 
          per_char_conf, status, reasons, ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        imageId,
        currentResult?.job_id,
        newVersion,
        'manual_correction',
        passport_number,
        JSON.stringify(Array(9).fill(100)), // 100% confidence for manual corrections
        'RESULT_CORRECTED',
        'Manual correction applied'
      ], function(err) {
        if (err) {
          res.status(500).json({ error: err.message })
          return
        }
        
        // Log correction in history
        db.run(`
          INSERT INTO history (actor, entity, entity_id, field, before_value, after_value)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          'operator',
          'result',
          this.lastID,
          'passport_number',
          currentResult?.passport_number || '',
          passport_number
        ])
        
        res.json({ success: true, version: newVersion })
      })
    })
  })
  
  // Reprocess image
  router.post('/results/:imageId/reprocess', (req, res) => {
    const { imageId } = req.params
    const { model, enhancement_profile, params = {} } = req.body
    
    // Add to processing queue
    services.pipeline.reprocessImage(imageId, {
      model,
      enhancement_profile,
      params
    })
    
    res.json({ success: true, message: 'Reprocessing queued' })
  })
}