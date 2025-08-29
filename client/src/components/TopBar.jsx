import React from 'react'
import { Search, Play, Pause, Square, Download, Upload, Filter, MoreHorizontal } from 'lucide-react'
import { useJob } from '../context/JobContext'
import { useWebSocket } from '../context/WebSocketContext'

const TopBar = ({ onUpload }) => {
  const { activeJob, filters, setFilters, startJob, pauseJob, stopJob } = useJob()
  const { metrics, isConnected } = useWebSocket()

  const handleSearchChange = (e) => {
    setFilters({ ...filters, search: e.target.value })
  }

  const handleStatusFilter = (status) => {
    setFilters({ ...filters, status: filters.status === status ? '' : status })
  }

  const exportData = () => {
    console.log('Exporting data...')
  }

  const statusFilters = [
    { key: 'SUCCESS', label: 'Success', color: 'emerald', count: 1247 },
    { key: 'REVIEW_REQUIRED', label: 'Review', color: 'amber', count: 23 },
    { key: 'DUPLICATE_CONFIRMED', label: 'Duplicates', color: 'orange', count: 8 },
    { key: 'ERROR', label: 'Errors', color: 'red', count: 2 },
  ]

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      {/* Main Header */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Search and Filters */}
          <div className="flex items-center space-x-6">
            {/* Enhanced Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search filenames, passport numbers, or processing notes..."
                value={filters.search}
                onChange={handleSearchChange}
                className="pl-12 pr-4 py-3 border border-gray-300 rounded-xl w-96 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              />
            </div>
            
            {/* Status Filter Pills */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              {statusFilters.map((status) => (
                <button
                  key={status.key}
                  onClick={() => handleStatusFilter(status.key)}
                  className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    filters.status === status.key
                      ? `bg-${status.color}-100 text-${status.color}-800 ring-2 ring-${status.color}-200`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{status.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    filters.status === status.key 
                      ? `bg-${status.color}-200 text-${status.color}-900`
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    {status.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-3">
            {/* Processing Controls */}
            {activeJob && (
              <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg">
                <button
                  onClick={() => startJob(activeJob.id)}
                  disabled={activeJob.status === 'RUNNING'}
                  className="p-2 bg-emerald-600 text-white rounded-lg disabled:bg-gray-400 hover:bg-emerald-700 transition-colors"
                >
                  <Play className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => pauseJob(activeJob.id)}
                  disabled={activeJob.status !== 'RUNNING'}
                  className="p-2 bg-amber-600 text-white rounded-lg disabled:bg-gray-400 hover:bg-amber-700 transition-colors"
                >
                  <Pause className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => stopJob(activeJob.id)}
                  disabled={activeJob.status === 'STOPPED'}
                  className="p-2 bg-red-600 text-white rounded-lg disabled:bg-gray-400 hover:bg-red-700 transition-colors"
                >
                  <Square className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* Main Actions */}
            <button
              onClick={exportData}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            
            <button
              onClick={onUpload}
              className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Images</span>
            </button>
            
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-6 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
        <div className="flex items-center justify-between">
          {/* Processing Status */}
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            {activeJob && (
              <>
                <div>
                  <span className="text-gray-600">Job:</span>
                  <span className="font-medium ml-1">{activeJob.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ml-1 ${
                    activeJob.status === 'RUNNING' ? 'text-emerald-600' :
                    activeJob.status === 'PAUSED' ? 'text-amber-600' :
                    'text-gray-600'
                  }`}>
                    {activeJob.status}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* System Metrics */}
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <span className="text-gray-600">CPU:</span>
                <span className={`font-medium ${
                  metrics.cpu > 80 ? 'text-red-600' : 
                  metrics.cpu > 60 ? 'text-amber-600' : 
                  'text-emerald-600'
                }`}>
                  {metrics.cpu}%
                </span>
              </div>
              
              <div className="flex items-center space-x-1">
                <span className="text-gray-600">RAM:</span>
                <span className={`font-medium ${
                  metrics.ram > 80 ? 'text-red-600' : 
                  metrics.ram > 60 ? 'text-amber-600' : 
                  'text-emerald-600'
                }`}>
                  {metrics.ram}%
                </span>
              </div>
              
              <div className="flex items-center space-x-1">
                <span className="text-gray-600">Throughput:</span>
                <span className="font-medium text-blue-600">{metrics.throughput}/min</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TopBar