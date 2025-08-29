import React, { createContext, useContext, useEffect, useState } from 'react'

const WebSocketContext = createContext()

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

export const WebSocketProvider = ({ children }) => {
  const [ws, setWs] = useState(null)
  const [connected, setConnected] = useState(false)
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const [metrics, setMetrics] = useState({
    cpu: 25,
    ram: 45,
    ramMB: 512,
    throughput: 15,
    queueDepths: {
      preprocess: 0,
      ocr: 0,
      fusion: 0,
      post: 0
    },
    workerStatus: {
      preprocess: { total: 2, busy: 0, idle: 2 },
      ocr: { total: 2, busy: 0, idle: 2 },
      fusion: { total: 2, busy: 0, idle: 2 },
      post: { total: 2, busy: 0, idle: 2 }
    }
  })

  useEffect(() => {
    // Only attempt WebSocket connection if environment supports it
    if (typeof window !== 'undefined' && window.WebSocket) {
      connectWebSocket()
    } else {
      console.log('WebSocket not supported, using fallback mode')
      setConnected(false)
      startFallbackMode()
    }
    
    return () => {
      if (ws) {
        ws.close(1000, 'Component unmounting')
      }
    }
  }, [])

  const connectWebSocket = () => {
    // Limit connection attempts to prevent infinite loops
    if (connectionAttempts >= 10) {
      console.log('Max WebSocket connection attempts reached, switching to fallback mode')
      startFallbackMode()
      return
    }

    try {
      // Use the current host and protocol to construct WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws`
      
      console.log(`WebSocket connection attempt ${connectionAttempts + 1}:`, wsUrl)
      
      const websocket = new WebSocket(wsUrl)
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (websocket.readyState === WebSocket.CONNECTING) {
          console.log('WebSocket connection timeout')
          websocket.close()
        }
      }, 5000)
      
      websocket.onopen = () => {
        clearTimeout(connectionTimeout)
        console.log('WebSocket connected successfully')
        setConnected(true)
        setConnectionAttempts(0)
        setWs(websocket)
      }
      
      websocket.onclose = (event) => {
        clearTimeout(connectionTimeout)
        console.log('WebSocket disconnected:', event.code, event.reason)
        setConnected(false)
        setWs(null)
        
        // Only attempt to reconnect if it wasn't a normal closure
        if (event.code !== 1000 && connectionAttempts < 10) {
          const delay = Math.min(5000 * Math.pow(2, connectionAttempts), 30000) // Exponential backoff
          console.log(`Attempting to reconnect WebSocket in ${delay}ms...`)
          setTimeout(() => {
            setConnectionAttempts(prev => prev + 1)
            connectWebSocket()
          }, delay)
        } else if (connectionAttempts >= 10) {
          console.log('Switching to fallback mode after failed connection attempts')
          startFallbackMode()
        }
      }
      
      websocket.onerror = (error) => {
        clearTimeout(connectionTimeout)
        console.error('WebSocket error:', error)
        setConnected(false)
      }
      
      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(data)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }
      
    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      setConnected(false)
      
      // Retry with exponential backoff
      if (connectionAttempts < 10) {
        const delay = Math.min(5000 * Math.pow(2, connectionAttempts), 30000)
        setTimeout(() => {
          setConnectionAttempts(prev => prev + 1)
          connectWebSocket()
        }, delay)
      } else {
        startFallbackMode()
      }
    }
  }

  const startFallbackMode = () => {
    console.log('Starting fallback mode - simulating metrics without WebSocket')
    setConnected(false)
    
    // Simulate periodic metrics updates
    const fallbackInterval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        cpu: Math.max(10, Math.min(90, prev.cpu + (Math.random() - 0.5) * 10)),
        ram: Math.max(10, Math.min(80, prev.ram + (Math.random() - 0.5) * 5)),
        throughput: Math.max(0, Math.min(50, prev.throughput + (Math.random() - 0.5) * 10))
      }))
    }, 5000)

    // Store interval for cleanup
    return () => clearInterval(fallbackInterval)
  }

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'connection':
        console.log('WebSocket connection confirmed:', data.status)
        break
        
      case 'systemMetrics':
        setMetrics(data.data)
        break
        
      case 'imageProcessed':
        console.log('Image processed:', data.data)
        window.dispatchEvent(new CustomEvent('imageProcessed', { detail: data.data }))
        break
        
      case 'jobStatusChanged':
        console.log('Job status changed:', data.data)
        window.dispatchEvent(new CustomEvent('jobStatusChanged', { detail: data.data }))
        break
        
      case 'queueUpdate':
        console.log('Queue updated:', data.data)
        setMetrics(prev => ({
          ...prev,
          queueDepths: data.data
        }))
        break
        
      case 'pong':
        console.log('Received pong from server')
        break
        
      case 'error':
        console.error('WebSocket server error:', data.message)
        break
        
      default:
        console.log('Unknown WebSocket message type:', data.type)
    }
  }

  const sendMessage = (message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message))
      } catch (error) {
        console.error('Error sending WebSocket message:', error)
      }
    } else {
      console.warn('WebSocket not connected, cannot send message:', message)
    }
  }

  const ping = () => {
    sendMessage({ type: 'ping' })
  }

  const subscribeToJob = (jobId) => {
    sendMessage({ type: 'subscribeToJob', jobId })
  }

  const getSystemStatus = () => {
    sendMessage({ type: 'getSystemStatus' })
  }

  const value = {
    connected,
    metrics,
    sendMessage,
    ping,
    subscribeToJob,
    getSystemStatus,
    connectionAttempts
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}