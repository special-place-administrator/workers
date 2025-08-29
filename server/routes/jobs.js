import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../database/init.js'

export const setupJobRoutes = (router, services) => {
  const { pipeline } = services

  // Get all jobs
  router.get('/jobs', (req, res) => {
    const db = getDatabase()
    
    db.all(`
      SELECT j.*, COUNT(i.id) as image_count
      FROM jobs j
      LEFT JOIN images i ON j.id = i.job_id
      GROUP BY j.id
      ORDER BY j.created_ts DESC
    `, (err, rows) => {
      if (err) {
        console.error('Error fetching jobs:', err)
        return res.status(500).json({ error: 'Failed to fetch jobs' })
      }
      res.json(rows || [])
    })
  })

  // Create new job
  router.post('/jobs', (req, res) => {
    const db = getDatabase()
    const { name, description = '' } = req.body
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Job name is required' })
    }
    
    const jobId = uuidv4()
    const now = new Date().toISOString()
    
    db.run(`
      INSERT INTO jobs (id, name, description, status, created_ts, updated_ts)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [jobId, name.trim(), description.trim(), 'CREATED', now, now], function(err) {
      if (err) {
        console.error('Error creating job:', err)
        return res.status(500).json({ error: 'Failed to create job' })
      }
      
      // Return the created job
      db.get('SELECT * FROM jobs WHERE id = ?', [jobId], (err, job) => {
        if (err) {
          console.error('Error fetching created job:', err)
          return res.status(500).json({ error: 'Job created but failed to fetch' })
        }
        
        res.status(201).json({
          ...job,
          image_count: 0
        })
      })
    })
  })

  // Get specific job
  router.get('/jobs/:id', (req, res) => {
    const db = getDatabase()
    const { id } = req.params
    
    db.get(`
      SELECT j.*, COUNT(i.id) as image_count
      FROM jobs j
      LEFT JOIN images i ON j.id = i.job_id
      WHERE j.id = ?
      GROUP BY j.id
    `, [id], (err, job) => {
      if (err) {
        console.error('Error fetching job:', err)
        return res.status(500).json({ error: 'Failed to fetch job' })
      }
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' })
      }
      
      res.json(job)
    })
  })

  // Update job
  router.put('/jobs/:id', (req, res) => {
    const db = getDatabase()
    const { id } = req.params
    const { name, description, status } = req.body
    
    const updates = []
    const values = []
    
    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name.trim())
    }
    
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description.trim())
    }
    
    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' })
    }
    
    updates.push('updated_ts = ?')
    values.push(new Date().toISOString())
    values.push(id)
    
    db.run(`
      UPDATE jobs 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values, function(err) {
      if (err) {
        console.error('Error updating job:', err)
        return res.status(500).json({ error: 'Failed to update job' })
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Job not found' })
      }
      
      // Return updated job
      db.get(`
        SELECT j.*, COUNT(i.id) as image_count
        FROM jobs j
        LEFT JOIN images i ON j.id = i.job_id
        WHERE j.id = ?
        GROUP BY j.id
      `, [id], (err, job) => {
        if (err) {
          console.error('Error fetching updated job:', err)
          return res.status(500).json({ error: 'Job updated but failed to fetch' })
        }
        res.json(job)
      })
    })
  })

  // Delete job
  router.delete('/jobs/:id', (req, res) => {
    const db = getDatabase()
    const { id } = req.params
    
    db.run('DELETE FROM jobs WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('Error deleting job:', err)
        return res.status(500).json({ error: 'Failed to delete job' })
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Job not found' })
      }
      
      res.json({ success: true, message: 'Job deleted successfully' })
    })
  })

  // Get job images
  router.get('/jobs/:id/images', (req, res) => {
    const db = getDatabase()
    const { id } = req.params
    const { status, page = 1, limit = 100 } = req.query
    
    let query = `
      SELECT i.*, r.passport_number, r.confidence, r.status as result_status,
             r.per_char_conf, r.reasons
      FROM images i
      LEFT JOIN results r ON i.id = r.image_id AND r.version = (
        SELECT MAX(version) FROM results WHERE image_id = i.id
      )
      WHERE i.job_id = ?
    `
    
    const params = [id]
    
    if (status && status !== 'all') {
      query += ' AND COALESCE(r.status, "PENDING") = ?'
      params.push(status)
    }
    
    query += ' ORDER BY i.upload_ts DESC'
    
    if (limit) {
      const offset = (parseInt(page) - 1) * parseInt(limit)
      query += ' LIMIT ? OFFSET ?'
      params.push(parseInt(limit), offset)
    }
    
    db.all(query, params, (err, images) => {
      if (err) {
        console.error('Error fetching job images:', err)
        return res.status(500).json({ error: 'Failed to fetch images' })
      }
      
      // Process results to include computed fields
      const processedImages = images.map(img => ({
        ...img,
        status: img.result_status || 'PENDING',
        confidence: img.confidence || 0,
        per_char_conf: img.per_char_conf ? JSON.parse(img.per_char_conf) : Array(9).fill(0)
      }))
      
      res.json(processedImages)
    })
  })

  // Start job processing
  router.post('/jobs/:id/start', (req, res) => {
    const { id } = req.params
    
    if (pipeline) {
      pipeline.startJob(id)
    }
    
    res.json({ success: true, message: 'Job processing started' })
  })

  // Pause job processing
  router.post('/jobs/:id/pause', (req, res) => {
    const { id } = req.params
    
    if (pipeline) {
      pipeline.pauseJob(id)
    }
    
    res.json({ success: true, message: 'Job processing paused' })
  })

  // Stop job processing
  router.post('/jobs/:id/stop', (req, res) => {
    const { id } = req.params
    
    if (pipeline) {
      pipeline.stopJob(id)
    }
    
    res.json({ success: true, message: 'Job processing stopped' })
  })
}