import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import http from 'http'
import { initDatabase } from './database/init.js'
import { setupJobRoutes } from './routes/jobs.js'
import { setupUploadRoutes } from './routes/upload.js'
import { setupSystemRoutes } from './routes/system.js'
import { setupProcessingRoutes } from './routes/processing.js'
import { setupSettingsRoutes } from './routes/settings.js'
import { ProcessingPipeline } from './services/ProcessingPipeline.js'
import { logSystem } from './services/SystemLogger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = http.createServer(app)
const port = process.env.PORT || 8001

// Initialize services
const services = {
  processingPipeline: new ProcessingPipeline()
}

// Middleware
app.use(cors())
app.use(express.json({ limit: '100mb' }))
app.use(express.urlencoded({ extended: true, limit: '100mb' }))

// Log all requests for debugging
app.use((req, res, next) => {
  logSystem('debug', 'HTTP', `${req.method} ${req.url}`, {
    userAgent: req.headers['user-agent'],
    contentLength: req.headers['content-length']
  })
  next()
})

// Initialize database
await initDatabase()
logSystem('info', 'Server', 'Database initialized successfully')

// API Routes
const apiRouter = express.Router()

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  })
})

// Setup route modules
setupJobRoutes(apiRouter, services)
setupUploadRoutes(apiRouter, services)
setupSystemRoutes(apiRouter, services)
setupProcessingRoutes(apiRouter, services)
setupSettingsRoutes(apiRouter, services)

app.use('/api', apiRouter)

// Serve thumbnails and images
app.get('/api/images/:imageId/thumb', async (req, res) => {
  try {
    const { imageId } = req.params
    const imagePath = path.join(process.cwd(), 'storage', 'thumbs', imageId.substring(0, 2), `${imageId}.webp`)
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Thumbnail not found' })
    }
    
    res.setHeader('Content-Type', 'image/webp')
    res.sendFile(imagePath)
  } catch (error) {
    logSystem('error', 'ImageServing', 'Failed to serve thumbnail', { 
      imageId: req.params.imageId, 
      error: error.message 
    })
    res.status(500).json({ error: 'Failed to serve image' })
  }
})

app.get('/api/images/:imageId/original', async (req, res) => {
  try {
    const { imageId } = req.params
    const imagePath = path.join(process.cwd(), 'storage', 'originals', imageId.substring(0, 2), imageId)
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' })
    }
    
    res.sendFile(imagePath)
  } catch (error) {
    logSystem('error', 'ImageServing', 'Failed to serve original image', { 
      imageId: req.params.imageId, 
      error: error.message 
    })
    res.status(500).json({ error: 'Failed to serve image' })
  }
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../client/dist')
  app.use(express.static(staticPath))
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'))
  })
}

// WebSocket server for real-time updates
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
})

const connectedClients = new Set()

wss.on('connection', (ws, req) => {
  connectedClients.add(ws)
  logSystem('info', 'WebSocket', 'Client connected', { 
    clientCount: connectedClients.size,
    userAgent: req.headers['user-agent']
  })

  ws.send(JSON.stringify({
    type: 'connection',
    status: 'connected',
    timestamp: new Date().toISOString()
  }))

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())
      handleWebSocketMessage(ws, message)
    } catch (error) {
      logSystem('error', 'WebSocket', 'Invalid message received', { error: error.message })
    }
  })

  ws.on('close', () => {
    connectedClients.delete(ws)
    logSystem('info', 'WebSocket', 'Client disconnected', { 
      clientCount: connectedClients.size
    })
  })

  ws.on('error', (error) => {
    logSystem('error', 'WebSocket', 'WebSocket error', { error: error.message })
    connectedClients.delete(ws)
  })
})

function handleWebSocketMessage(ws, message) {
  logSystem('debug', 'WebSocket', 'Message received', { type: message.type })

  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }))
      break
    
    case 'getSystemStatus':
      ws.send(JSON.stringify({
        type: 'systemStatus',
        data: {
          processing: services.processingPipeline.getStatus(),
          clients: connectedClients.size,
          uptime: process.uptime()
        }
      }))
      break
    
    default:
      logSystem('warn', 'WebSocket', 'Unknown message type', { type: message.type })
  }
}

function broadcastToClients(message) {
  const messageStr = JSON.stringify(message)
  let activeClients = 0
  
  connectedClients.forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(messageStr)
        activeClients++
      } catch (error) {
        logSystem('error', 'WebSocket', 'Failed to send message to client', { error: error.message })
        connectedClients.delete(ws)
      }
    } else {
      connectedClients.delete(ws)
    }
  })
  
  if (activeClients > 0) {
    logSystem('debug', 'WebSocket', 'Broadcast sent', { 
      activeClients, 
      messageType: message.type 
    })
  }
}

// Setup processing pipeline event handlers
services.processingPipeline.on('jobStarted', (data) => {
  logSystem('info', 'Processing', 'Job started', data)
  broadcastToClients({
    type: 'jobStarted',
    data
  })
})

services.processingPipeline.on('progress', (data) => {
  logSystem('debug', 'Processing', 'Progress update', data)
  broadcastToClients({
    type: 'progress',
    data
  })
})

services.processingPipeline.on('imageProcessed', (data) => {
  logSystem('debug', 'Processing', 'Image processed', data)
  broadcastToClients({
    type: 'imageProcessed',
    data
  })
})

services.processingPipeline.on('jobCompleted', (data) => {
  logSystem('success', 'Processing', 'Job completed', data)
  broadcastToClients({
    type: 'jobCompleted',
    data
  })
})

services.processingPipeline.on('jobError', (data) => {
  logSystem('error', 'Processing', 'Job error', data)
  broadcastToClients({
    type: 'jobError',
    data
  })
})

// Start server
server.listen(port, () => {
  logSystem('success', 'Server', 'Server started successfully', {
    port,
    environment: process.env.NODE_ENV || 'development',
    modelUrl: process.env.MODEL_URL || 'http://10.4.0.15:11434',
    modelName: process.env.MODEL_NAME || 'benhaotang/Nanonets-OCR-s:latest'
  })
  
  console.log(`🚀 Smart Passport OCR Server running on port ${port}`)
  console.log(`📊 System logs available at http://localhost:${port}`)
  console.log(`🔧 Model endpoint: ${process.env.MODEL_URL || 'http://10.4.0.15:11434'}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logSystem('info', 'Server', 'SIGTERM received, shutting down gracefully')
  
  server.close(() => {
    logSystem('info', 'Server', 'Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logSystem('info', 'Server', 'SIGINT received, shutting down gracefully')
  
  server.close(() => {
    logSystem('info', 'Server', 'Server closed')
    process.exit(0)
  })
})