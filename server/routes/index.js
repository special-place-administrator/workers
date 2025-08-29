import { Router } from 'express'
import { setupJobRoutes } from './jobs.js'
import { setupUploadRoutes } from './upload.js'
import { setupImageRoutes } from './images.js'
import { setupResultRoutes } from './results.js'
import { setupDuplicateRoutes } from './duplicates.js'
import { setupSettingsRoutes } from './settings.js'

export const setupRoutes = (app, services) => {
  const router = Router()
  
  // Health check
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })
  
  // Setup route modules
  setupJobRoutes(router, services)
  setupUploadRoutes(router, services)
  setupImageRoutes(router, services)
  setupResultRoutes(router, services)
  setupDuplicateRoutes(router, services)
  setupSettingsRoutes(router, services)
  
  app.use('/api', router)
}