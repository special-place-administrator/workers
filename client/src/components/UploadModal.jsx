import React, { useState, useRef } from 'react'
import { X, Upload, AlertCircle, CheckCircle, Loader, FileImage, Archive, File, Settings } from 'lucide-react'
import axios from 'axios'
import UploadSettingsModal from './UploadSettingsModal'

const UploadModal = ({ isOpen, onClose, activeJob, onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragEnter = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelection(files)
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      handleFileSelection(files)
    }
  }

  const handleFileSelection = (files) => {
    // Process and validate files
    const processedFiles = files.map(file => {
      const fileInfo = {
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        reason: '',
        icon: getFileIcon(file)
      }

      // Validate file
      const validation = validateFile(file)
      fileInfo.status = validation.valid ? 'valid' : 'invalid'
      fileInfo.reason = validation.reason

      return fileInfo
    })

    setSelectedFiles(processedFiles)
  }

  const validateFile = (file) => {
    // Check file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      return { valid: false, reason: 'File too large (max 100MB)' }
    }

    // Check file type
    const validTypes = [
      // ZIP files
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
      // Image files
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/bmp',
      'image/tiff',
      'image/tif'
    ]

    if (!validTypes.includes(file.type)) {
      // Additional check for files without proper MIME type
      const ext = file.name.toLowerCase().split('.').pop()
      const validExtensions = ['zip', 'jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif']
      
      if (!validExtensions.includes(ext)) {
        return { valid: false, reason: 'Unsupported file type' }
      }
    }

    // More permissive size check - allow small files for cropped passport images
    if (file.size < 100) { // Only reject truly tiny files (less than 100 bytes)
      return { valid: false, reason: 'File too small (likely corrupt)' }
    }

    return { valid: true, reason: 'Valid file' }
  }

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) {
      return FileImage
    } else if (file.type.includes('zip')) {
      return Archive
    }
    return File
  }

  const handleUpload = async () => {
    if (!activeJob) {
      alert('Please select a job first')
      return
    }

    const validFiles = selectedFiles.filter(f => f.status === 'valid')
    if (validFiles.length === 0) {
      alert('No valid files to upload')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setUploadResult(null)

    try {
      const results = {
        successful: 0,
        failed: 0,
        skipped: 0,
        totalImages: 0,
        errors: []
      }

      // Upload files one by one for better progress tracking
      for (let i = 0; i < validFiles.length; i++) {
        const fileInfo = validFiles[i]
        const formData = new FormData()
        formData.append('file', fileInfo.file)
        formData.append('jobId', activeJob.id)
        formData.append('uploadType', fileInfo.file.type.includes('zip') ? 'zip' : 'image')

        try {
          const response = await axios.post('/api/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
              const fileProgress = (progressEvent.loaded * 100) / progressEvent.total
              const overallProgress = ((i + fileProgress / 100) / validFiles.length) * 100
              setUploadProgress(Math.round(overallProgress))
            },
            timeout: 300000 // 5 minutes timeout
          })

          if (response.data.success) {
            results.successful++
            results.totalImages += response.data.stats?.successful || 0
            fileInfo.status = 'uploaded'
          } else {
            results.failed++
            results.errors.push(`${fileInfo.name}: ${response.data.error}`)
            fileInfo.status = 'failed'
          }

        } catch (error) {
          results.failed++
          results.errors.push(`${fileInfo.name}: ${error.response?.data?.error || error.message}`)
          fileInfo.status = 'failed'
        }
      }

      setUploadResult({
        success: results.successful > 0,
        message: `Upload completed: ${results.successful} files successful, ${results.failed} failed`,
        stats: results
      })

      // Notify parent component to refresh data
      if (onUploadComplete && results.successful > 0) {
        onUploadComplete()
      }

    } catch (error) {
      console.error('Upload error:', error)
      setUploadResult({
        success: false,
        message: 'Upload failed: ' + (error.message || 'Unknown error')
      })
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleClose = () => {
    if (!uploading) {
      setUploadResult(null)
      setSelectedFiles([])
      setUploadProgress(0)
      onClose()
    }
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Upload Passport Images</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Upload Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={handleClose}
                disabled={uploading}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Job Info */}
            {activeJob && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-800">
                  <strong>Target Job:</strong> {activeJob.name}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Current images: {activeJob.image_count || 0}
                </div>
              </div>
            )}

            {!activeJob && (
              <div className="mb-4 p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center space-x-2 text-amber-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Please select a job first</span>
                </div>
              </div>
            )}

            {/* Upload Result */}
            {uploadResult && (
              <div className={`mb-4 p-4 rounded-lg ${
                uploadResult.success 
                  ? 'bg-emerald-50 border border-emerald-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start space-x-2">
                  {uploadResult.success ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className={`font-medium ${
                      uploadResult.success ? 'text-emerald-800' : 'text-red-800'
                    }`}>
                      {uploadResult.success ? 'Upload Completed!' : 'Upload Failed'}
                    </div>
                    <div className={`text-sm mt-1 ${
                      uploadResult.success ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                      {uploadResult.message}
                    </div>
                    
                    {uploadResult.success && uploadResult.stats && (
                      <div className="mt-2 text-sm text-emerald-600 space-y-1">
                        <div>✓ {uploadResult.stats.totalImages} images processed successfully</div>
                        {uploadResult.stats.failed > 0 && (
                          <div>⚠ {uploadResult.stats.failed} files failed</div>
                        )}
                        {uploadResult.stats.skipped > 0 && (
                          <div>⏭ {uploadResult.stats.skipped} files skipped</div>
                        )}
                      </div>
                    )}

                    {uploadResult.stats?.errors?.length > 0 && (
                      <div className="mt-2 text-sm text-red-600">
                        <details>
                          <summary className="cursor-pointer">Show errors ({uploadResult.stats.errors.length})</summary>
                          <ul className="mt-1 space-y-1">
                            {uploadResult.stats.errors.map((error, idx) => (
                              <li key={idx} className="text-xs">• {error}</li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* File Drop Zone */}
            {selectedFiles.length === 0 && (
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-blue-400 bg-blue-50'
                    : uploading
                    ? 'border-gray-300 bg-gray-50'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                } ${!activeJob ? 'opacity-50 cursor-not-allowed' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !uploading && activeJob && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".zip,.jpg,.jpeg,.png,.bmp,.tiff,.tif"
                  onChange={handleFileSelect}
                  disabled={uploading || !activeJob}
                  multiple
                />

                <div className="space-y-4">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <div className="text-lg font-medium text-gray-900">
                      {isDragging ? 'Drop files here' : 'Click to select files or drag & drop'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      ZIP archives or individual passport images
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Supports: ZIP archives, JPEG, PNG, BMP, TIFF • Max 100MB per file
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-800">Selected Files ({selectedFiles.length})</h4>
                  <button
                    onClick={() => setSelectedFiles([])}
                    disabled={uploading}
                    className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                  >
                    Clear all
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedFiles.map((fileInfo, index) => {
                    const Icon = fileInfo.icon
                    return (
                      <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg border ${
                        fileInfo.status === 'valid' ? 'border-green-200 bg-green-50' :
                        fileInfo.status === 'invalid' ? 'border-red-200 bg-red-50' :
                        fileInfo.status === 'uploaded' ? 'border-emerald-200 bg-emerald-50' :
                        fileInfo.status === 'failed' ? 'border-red-200 bg-red-50' :
                        'border-gray-200 bg-gray-50'
                      }`}>
                        <Icon className={`w-5 h-5 ${
                          fileInfo.status === 'valid' ? 'text-green-600' :
                          fileInfo.status === 'invalid' ? 'text-red-600' :
                          fileInfo.status === 'uploaded' ? 'text-emerald-600' :
                          fileInfo.status === 'failed' ? 'text-red-600' :
                          'text-gray-600'
                        }`} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {fileInfo.name}
                          </div>
                          <div className="text-xs text-gray-600">
                            {(fileInfo.size / 1024).toFixed(1)} KB • {fileInfo.reason}
                          </div>
                        </div>

                        {fileInfo.status === 'uploaded' && (
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                        )}

                        {fileInfo.status === 'failed' && (
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        )}

                        {!uploading && fileInfo.status !== 'uploaded' && (
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Uploading files...</span>
                      <span className="font-medium text-gray-900">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            {!uploadResult && selectedFiles.length === 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Optimized for Cropped Passport Images:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>Small Files Welcome:</strong> Accepts images as small as 512 bytes</li>
                  <li>• <strong>ZIP Processing:</strong> Extracts only valid images, ignores other files</li>
                  <li>• <strong>Flexible Dimensions:</strong> Handles cropped passport number sections</li>
                  <li>• <strong>Smart Validation:</strong> Configurable limits via settings button</li>
                  <li>• <strong>Multiple Formats:</strong> JPEG, PNG, BMP, TIFF support</li>
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between space-x-3 p-6 border-t border-gray-200">
            <button
              onClick={handleClose}
              disabled={uploading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {uploadResult?.success ? 'Close' : 'Cancel'}
            </button>

            {selectedFiles.length > 0 && !uploadResult && (
              <button
                onClick={handleUpload}
                disabled={uploading || !activeJob || selectedFiles.filter(f => f.status === 'valid').length === 0}
                className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 transition-all font-medium"
              >
                {uploading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload {selectedFiles.filter(f => f.status === 'valid').length} Files</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload Settings Modal */}
      <UploadSettingsModal 
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </>
  )
}

export default UploadModal