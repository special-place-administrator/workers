import React, { useState, useEffect } from 'react'
import { Search, Filter, Calendar, Play, Pause, Square, RotateCcw, Download, Eye, Users, FileText, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import TableView from './TableView'
import { useJob } from '../context/JobContext'

const MainWorkspace = () => {
  const { jobs, activeJob, images, loadImages } = useJob()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (activeJob) {
      loadImages(activeJob.id)
    }
  }, [activeJob, loadImages])

  const handleStartProcessing = () => {
    setIsProcessing(true)
    // In a real implementation, this would call the API
    setTimeout(() => setIsProcessing(false), 3000)
  }

  const statusCounts = {
    total: images.length,
    success: images.filter(img => img.status === 'SUCCESS').length,
    pending: images.filter(img => img.status === 'PENDING' || !img.status).length,
    review: images.filter(img => img.status === 'REVIEW_REQUIRED').length,
    error: images.filter(img => img.status === 'ERROR').length
  }

  const filteredImages = images.filter(image => {
    if (searchQuery && !image.filename.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    if (statusFilter !== 'all' && image.status !== statusFilter) {
      return false
    }
    return true
  })

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Top Controls */}
      <div className="border-b border-gray-200 bg-white">
        {/* Search and Filters */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search filenames, passport numbers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="SUCCESS">Success</option>
                <option value="PENDING">Pending</option>
                <option value="REVIEW_REQUIRED">Review Required</option>
                <option value="ERROR">Error</option>
              </select>
              <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Date Range */}
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Export */}
            <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Processing Controls */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            {/* Left: Processing Controls */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleStartProcessing}
                disabled={!activeJob || isProcessing}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 disabled:from-gray-400 disabled:to-gray-500 transition-all font-medium"
              >
                {isProcessing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isProcessing ? 'Pause' : 'Start'}</span>
              </button>

              <button
                disabled={!isProcessing}
                className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </button>

              <button className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>

              {/* Progress */}
              {isProcessing && (
                <div className="flex items-center space-x-3 ml-6">
                  <div className="text-sm text-gray-600">Processing...</div>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full animate-pulse" style={{ width: '45%' }}></div>
                  </div>
                  <div className="text-sm font-medium text-gray-900">45%</div>
                </div>
              )}
            </div>

            {/* Right: Status Summary */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Success: {statusCounts.success}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span className="text-sm text-gray-600">Pending: {statusCounts.pending}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Review: {statusCounts.review}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Error: {statusCounts.error}</span>
              </div>
              <div className="text-sm font-medium text-gray-900">
                Total: {statusCounts.total}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeJob ? (
          <TableView images={filteredImages} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-900">No Job Selected</h3>
                <p className="text-gray-600">Create or select a job from the right panel to get started</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MainWorkspace