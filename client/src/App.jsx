import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { JobProvider } from './context/JobContext'
import { WebSocketProvider } from './context/WebSocketContext'
import MainLayout from './components/MainLayout'

function App() {
  return (
    <Router>
      <WebSocketProvider>
        <JobProvider>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <Routes>
              <Route path="/*" element={<MainLayout />} />
            </Routes>
          </div>
        </JobProvider>
      </WebSocketProvider>
    </Router>
  )
}

export default App