import React, { useState, useEffect } from 'react'
import { useJob } from '../context/JobContext'
import JobList from './JobList'
import ImageGrid from './ImageGrid'
import TableView from './TableView'
import ReviewView from './ReviewView'
import DuplicateCompareView from './DuplicateCompareView'
import { Grid3X3, List, FileImage } from 'lucide-react'

const JobDashboard = () => {
  const { activeJob, images } = useJob()
  const [viewMode, setViewMode] = useState('table')
  const [selectedImage, setSelectedImage] = useState(null)
  const [duplicateComparison, setDuplicateComparison] = useState(null)

  // Handle image selection from table view
  const handleImageSelect = (image) => {
    setSelectedImage(image)
    setViewMode('review')
  }

  // Handle duplicate comparison
  const handleDuplicateCompare = (duplicateData) => {
    setDuplicateComparison(duplicateData)
    setViewMode('duplicate')
  }

  // Handle back navigation
  const handleBack = () => {
    setSelectedImage(null)
    setDuplicateComparison(null)
    setViewMode('table')
  }

  // Reset view when job changes
  useEffect(() => {
    if (activeJob) {
      handleBack()
    }
  }, [activeJob])

  const renderContent = () => {
    if (viewMode === 'review' && selectedImage) {
      return (
        <ReviewView 
          image={selectedImage} 
          onBack={handleBack}
        />
      )
    }

    if (viewMode === 'duplicate' && duplicateComparison) {
      return (
        <DuplicateCompareView 
          duplicateData={duplicateComparison}
          onBack={handleBack}
        />
      )
    }

    if (!activeJob) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <FileImage className="w-16 h-16 text-gray-400 mx-auto" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">No Job Selected</h3>
              <p className="text-gray-600">Select or create a job to get started</p>
            </div>
          </div>
        </div>
      )
    }

    // Show appropriate view based on mode
    if (viewMode === 'grid') {
      return (
        <ImageGrid 
          onImageSelect={handleImageSelect}
          onDuplicateCompare={handleDuplicateCompare}
        />
      )
    }

    return (
      <TableView 
        onImageSelect={handleImageSelect}
        onDuplicateCompare={handleDuplicateCompare}
      />
    )
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Sidebar - Job List */}
      <div className="w-80 bg-white border-r border-gray-200 flex-shrink-0">
        <JobList />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* View Controls - Only show when we have an active job and not in review/duplicate modes */}
        {activeJob && viewMode !== 'review' && viewMode !== 'duplicate' && (
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {activeJob.name}
                </h2>
                <div className="text-sm text-gray-600">
                  {images?.length || 0} images
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'table'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    <span>Table</span>
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                    <span>Grid</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default JobDashboard