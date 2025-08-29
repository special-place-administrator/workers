import React, { useState } from 'react'
import { Upload, FileText, Settings, Monitor, Database, Terminal } from 'lucide-react'
import SystemLogsModal from './SystemLogsModal'

const Header = ({ onUploadClick }) => {
  const [logsModalOpen, setLogsModalOpen] = useState(false)

  return (
    <>
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left: Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Smart Passport OCR</h1>
                <p className="text-sm text-gray-600">Character-Level Analysis System</p>
              </div>
            </div>
          </div>

          {/* Center: Quick Actions */}
          <div className="flex items-center space-x-4">
            <button
              onClick={onUploadClick}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-lg"
            >
              <Upload className="w-5 h-5" />
              <span>Upload Files</span>
            </button>

            <button
              onClick={() => setLogsModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-medium shadow-lg"
            >
              <Terminal className="w-5 h-5" />
              <span>System Logs</span>
            </button>
          </div>

          {/* Right: Status */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">System Online</span>
            </div>
          </div>
        </div>
      </header>

      <SystemLogsModal 
        isOpen={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
      />
    </>
  )
}

export default Header