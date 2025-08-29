import React, { useState, useEffect } from 'react'
import { Play, Pause, Square, FileImage, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react'
import { useJob } from '../context/JobContext'
import axios from 'axios'

const ImageGrid = () => {
  const { activeJob, images, loadImages } = useJob()
  const [processing, setProcessing] = useState(false)
  const [processStatus, setProcessStatus] = useState(null)
  const [results, setResults] = useState({})

  useEffect(() => {
    if (activeJob) {
      loadResults()
      
      // Set up polling for processing status
      const interval = setInterval(checkProcessingStatus, 2000)
      return () => clearInterval(interval)
    }
  }, [activeJob])

  const loadResults = async () => {
    if (!activeJob) return
    
    try {
      const response = await axios.get(`/api/jobs/${activeJob.id}/results`)
      if (response.data.success) {
        const resultsMap = {}
        response.data.results.forEach(result => {
          resultsMap[result.image_id] = result
        })
        setResults(resultsMap)
      }
    } catch (error) {
      console.error('Error loading results:', error)
    }
  }

  const checkProcessingStatus = async () => {
    try {
      const response = await axios.get('/api/processing/status')
      if (response.data.success) {
        setProcessStatus(response.data.status)
        setProcessing(response.data.status.isProcessing)
        
        // Reload images and results if processing is active
        if (response.data.status.isProcessing && activeJob) {
          loadImages(activeJob.id)
          loadResults()
        }
      }
    } catch (error) {
      console.error('Error checking processing status:', error)
    }
  }

  const startProcessing = async () => {
    if (!activeJob) return
    
    try {
      const response = await axios.post(`/api/processing/jobs/${activeJob.id}/start`)
      if (response.data.success) {
        setProcessing(true)
        console.log('Processing started successfully')
      } else {
        alert('Failed to start processing: ' + response.data.error)
      }
    } catch (error) {
      console.error('Error starting processing:', error)
      alert('Failed to start processing: ' + error.message)
    }
  }

  const pauseProcessing = async () => {
    if (!activeJob) return
    
    try {
      const response = await axios.post(`/api/processing/jobs/${activeJob.id}/pause`)
      if (response.data.success) {
        setProcessing(false)
        console.log('Processing paused')
      }
    } catch (error) {
      console.error('Error pausing processing:', error)
    }
  }

  const stopProcessing = async () => {
    if (!activeJob) return
    
    try {
      const response = await axios.post(`/api/processing/jobs/${activeJob.id}/stop`)
      if (response.data.success) {
        setProcessing(false)
        console.log('Processing stopped')
      }
    } catch (error) {
      console.error('Error stopping processing:', error)
    }
  }

  const getStatusIcon = (result) => {
    if (!result) return <Clock className="w-4 h-4 text-gray-400" />
    
    switch (result.status) {
      case 'SUCCESS':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'REVIEW_REQUIRED':
        return <AlertCircle className="w-4 h-4 text-amber-500" />
      case 'ERROR':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (result) => {
    if (!result) return 'border-gray-200 bg-gray-50'
    
    switch (result.status) {
      case 'SUCCESS':
        return 'border-emerald-200 bg-emerald-50'
      case 'REVIEW_REQUIRED':
        return 'border-amber-200 bg-amber-50'
      case 'ERROR':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  if (!activeJob) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <FileImage className="w-16 h-16 text-gray-400 mx-auto" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">No Job Selected</h3>
            <p className="text-gray-600">Select a job to view and process images</p>
          </div>
        </div>
      </div>
    )
  }

  if (!images || images.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <FileImage className="w-16 h-16 text-gray-400 mx-auto" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">No Images Found</h3>
            <p className="text-gray-600">Upload some images to get started</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Processing Controls */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {activeJob.name} ({images.length} images)
            </h2>
            
            {processStatus && (
              <div className="text-sm text-gray-600">
                {processStatus.isProcessing ? (
                  <span className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>Processing: {processStatus.processedCount}/{processStatus.totalCount} ({processStatus.percentage}%)</span>
                  </span>
                ) : (
                  <span>Ready to process</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {!processing ? (
              <button
                onClick={startProcessing}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>Process</span>
              </button>
            ) : (
              <>
                <button
                  onClick={pauseProcessing}
                  className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={stopProcessing}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {processStatus && processStatus.isProcessing && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${processStatus.percentage}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Images Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {images.map((image) => {
            const result = results[image.id]
            
            return (
              <div
                key={image.id}
                className={`relative border-2 rounded-lg overflow-hidden transition-all hover:shadow-lg ${getStatusColor(result)}`}
              >
                {/* Image Thumbnail */}
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  <img
                    src={`/api/images/${image.id}/thumbnail`}
                    alt={image.filename}
                    className="max-w-full max-h-full object-contain"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  <div className="hidden items-center justify-center w-full h-full">
                    <FileImage className="w-8 h-8 text-gray-400" />
                  </div>
                </div>

                {/* Status Overlay */}
                <div className="absolute top-2 right-2">
                  {getStatusIcon(result)}
                </div>

                {/* Result Info */}
                <div className="p-2 bg-white bg-opacity-90">
                  <div className="text-xs font-medium text-gray-900 truncate">
                    {image.filename}
                  </div>
                  {result && (
                    <div className="mt-1">
                      {result.passport_number ? (
                        <div className="text-xs font-mono font-bold text-gray-900">
                          {result.passport_number}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          {result.status}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        {result.confidence}% confidence
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ImageGrid