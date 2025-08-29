import { getDatabase } from '../database/init.js'
import { logSystem } from '../services/SystemLogger.js'

export const setupSettingsRoutes = (router, services) => {
  // Get all settings
  router.get('/settings', (req, res) => {
    const db = getDatabase()
    
    db.all('SELECT key, value FROM settings ORDER BY key', (err, rows) => {
      if (err) {
        logSystem('error', 'SettingsAPI', 'Failed to fetch settings', { error: err.message })
        return res.status(500).json({ error: 'Failed to fetch settings' })
      }
      
      const settings = {}
      rows.forEach(row => {
        try {
          settings[row.key] = JSON.parse(row.value)
        } catch (parseErr) {
          // If JSON parsing fails, treat as string
          settings[row.key] = row.value
        }
      })
      
      logSystem('info', 'SettingsAPI', 'Settings fetched successfully', { count: rows.length })
      res.json({ success: true, settings })
    })
  })

  // Update settings
  router.post('/settings', (req, res) => {
    const db = getDatabase()
    const settings = req.body
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid settings data' 
      })
    }

    logSystem('info', 'SettingsAPI', 'Updating settings', { 
      keys: Object.keys(settings),
      count: Object.keys(settings).length 
    })

    // Use a transaction to update all settings atomically
    db.serialize(() => {
      db.run('BEGIN TRANSACTION')
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_ts) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `)
      
      let errors = []
      let updateCount = 0
      
      for (const [key, value] of Object.entries(settings)) {
        try {
          const jsonValue = JSON.stringify(value)
          stmt.run(key, jsonValue, (err) => {
            if (err) {
              errors.push(`Failed to update ${key}: ${err.message}`)
            } else {
              updateCount++
            }
          })
        } catch (error) {
          errors.push(`Failed to serialize ${key}: ${error.message}`)
        }
      }
      
      stmt.finalize((err) => {
        if (err || errors.length > 0) {
          db.run('ROLLBACK')
          logSystem('error', 'SettingsAPI', 'Failed to update settings', { 
            errors,
            sqlError: err?.message 
          })
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to update settings',
            details: errors 
          })
        } else {
          db.run('COMMIT', (commitErr) => {
            if (commitErr) {
              logSystem('error', 'SettingsAPI', 'Failed to commit settings transaction', { 
                error: commitErr.message 
              })
              return res.status(500).json({ 
                success: false, 
                error: 'Failed to save settings' 
              })
            }
            
            logSystem('success', 'SettingsAPI', 'Settings updated successfully', { 
              updateCount 
            })
            res.json({ 
              success: true, 
              message: `Successfully updated ${updateCount} settings`
            })
          })
        }
      })
    })
  })

  // Get specific setting
  router.get('/settings/:key', (req, res) => {
    const db = getDatabase()
    const { key } = req.params
    
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) {
        logSystem('error', 'SettingsAPI', 'Failed to fetch setting', { key, error: err.message })
        return res.status(500).json({ error: 'Failed to fetch setting' })
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Setting not found' })
      }
      
      try {
        const value = JSON.parse(row.value)
        res.json({ success: true, key, value })
      } catch (parseErr) {
        res.json({ success: true, key, value: row.value })
      }
    })
  })

  // Delete setting
  router.delete('/settings/:key', (req, res) => {
    const db = getDatabase()
    const { key } = req.params
    
    db.run('DELETE FROM settings WHERE key = ?', [key], function(err) {
      if (err) {
        logSystem('error', 'SettingsAPI', 'Failed to delete setting', { key, error: err.message })
        return res.status(500).json({ error: 'Failed to delete setting' })
      }
      
      logSystem('info', 'SettingsAPI', 'Setting deleted', { key, changes: this.changes })
      res.json({ 
        success: true, 
        message: this.changes > 0 ? 'Setting deleted' : 'Setting not found'
      })
    })
  })
}