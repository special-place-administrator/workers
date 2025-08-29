import { WebSocketServer } from 'ws'
import { getDatabase } from '../database/init.js'

export function setupWebSocket(server, pipeline) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  })

  console.log('WebSocket server initialized on /ws')

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected from:', req.socket.remoteAddress)
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      timestamp: new Date().toISOString()
    }))

    // Handle client messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString())
        handleClientMessage(ws, data, pipeline)
      } catch (error) {
        console.error('Invalid WebSocket message:', error)
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }))
      }
    })

    // Handle connection close
    ws.on('close', () => {
      console.log('WebSocket client disconnected')
    })

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    // Send periodic updates
    const updateInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        sendSystemMetrics(ws, pipeline)
      } else {
        clearInterval(updateInterval)
      }
    }, 5000) // Send updates every 5 seconds
  })

  // Listen to pipeline events
  if (pipeline) {
    pipeline.on('imageProcessed', (data) => {
      broadcast(wss, {
        type: 'imageProcessed',
        data: data
      })
    })

    pipeline.on('jobStatusChanged', (data) => {
      broadcast(wss, {
        type: 'jobStatusChanged',
        data: data
      })
    })

    pipeline.on('queueUpdate', (data) => {
      broadcast(wss, {
        type: 'queueUpdate',
        data: data
      })
    })
  }

  return wss
}

function handleClientMessage(ws, data, pipeline) {
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString()
      }))
      break

    case 'getSystemStatus':
      sendSystemMetrics(ws, pipeline)
      break

    case 'getJobStatus':
      if (data.jobId) {
        sendJobStatus(ws, data.jobId)
      }
      break

    case 'subscribeToJob':
      // In a more complex implementation, we'd track subscriptions
      ws.subscribedJobs = ws.subscribedJobs || new Set()
      if (data.jobId) {
        ws.subscribedJobs.add(data.jobId)
      }
      break

    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${data.type}`
      }))
  }
}

function sendSystemMetrics(ws, pipeline) {
  try {
    const memUsage = process.memoryUsage()
    const ramUsageMB = Math.round(memUsage.rss / 1024 / 1024)
    const ramUsagePct = Math.round((memUsage.rss / (1024 * 1024 * 1024)) * 100)

    // Get CPU usage (simplified)
    const cpuUsage = process.cpuUsage()
    const cpuPercent = Math.min(100, Math.round(
      (cpuUsage.user + cpuUsage.system) / 1000000 / 5 * 100
    ))

    const metrics = {
      cpu: Math.max(15, Math.min(95, cpuPercent + Math.random() * 20)), // Simulated with some variance
      ram: Math.max(10, Math.min(90, ramUsagePct)),
      ramMB: ramUsageMB,
      throughput: Math.round(Math.random() * 50 + 10), // Simulated throughput
      queueDepths: pipeline ? pipeline.getQueueMetrics() : {
        preprocess: 0,
        ocr: 0,
        fusion: 0,
        post: 0
      },
      workerStatus: pipeline ? pipeline.getWorkerMetrics() : {
        preprocess: { total: 2, busy: 0, idle: 2 },
        ocr: { total: 2, busy: 0, idle: 2 },
        fusion: { total: 2, busy: 0, idle: 2 },
        post: { total: 2, busy: 0, idle: 2 }
      },
      timestamp: new Date().toISOString()
    }

    ws.send(JSON.stringify({
      type: 'systemMetrics',
      data: metrics
    }))
  } catch (error) {
    console.error('Error sending system metrics:', error)
  }
}

function sendJobStatus(ws, jobId) {
  const db = getDatabase()
  
  // Get job details
  db.get('SELECT * FROM jobs WHERE id = ?', [jobId], (err, job) => {
    if (err || !job) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Job not found'
      }))
      return
    }

    // Get processing statistics
    db.all(`
      SELECT 
        status,
        COUNT(*) as count
      FROM images i
      LEFT JOIN results r ON i.id = r.image_id AND r.version = (
        SELECT MAX(version) FROM results WHERE image_id = i.id
      )
      WHERE i.job_id = ?
      GROUP BY COALESCE(r.status, 'PENDING')
    `, [jobId], (err, stats) => {
      if (err) {
        console.error('Error getting job stats:', err)
        return
      }

      const statusCounts = {}
      stats.forEach(stat => {
        statusCounts[stat.status || 'PENDING'] = stat.count
      })

      ws.send(JSON.stringify({
        type: 'jobStatus',
        data: {
          job: job,
          statusCounts: statusCounts,
          timestamp: new Date().toISOString()
        }
      }))
    })
  })
}

function broadcast(wss, message) {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      try {
        client.send(JSON.stringify(message))
      } catch (error) {
        console.error('Error broadcasting message:', error)
      }
    }
  })
}