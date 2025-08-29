import React, { useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'
import { useJob } from '../context/JobContext'
import ConfidenceChips from './ConfidenceChips'
import { Check, AlertTriangle, Copy, X, Eye, Clock, FileImage } from 'lucide-react'

const TableView = ({ onImageSelect, onDuplicateCompare }) => {
  const { images, loading } = useJob()

  const getStatusIcon = (status) => {
    switch (status) {
      case 'SUCCESS':
        return <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      case 'REVIEW_REQUIRED':
        return <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-white" />
        </div>
      case 'DUPLICATE_CONFIRMED':
        return <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
          <Copy className="w-4 h-4 text-white" />
        </div>
      case 'ERROR':
        return <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
          <X className="w-4 h-4 text-white" />
        </div>
      case 'PROCESSING':
        return <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
          <Clock className="w-4 h-4 text-white" />
        </div>
      default:
        return <div className="w-6 h-6 bg-gray-400 rounded-full" />
    }
  }

  const getStatusBadge = (status, confidence) => {
    const baseClasses = "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"

    switch (status) {
      case 'SUCCESS':
        return `${baseClasses} bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200`
      case 'REVIEW_REQUIRED':
        return `${baseClasses} bg-amber-100 text-amber-800 ring-1 ring-amber-200`
      case 'DUPLICATE_CONFIRMED':
        return `${baseClasses} bg-orange-100 text-orange-800 ring-1 ring-orange-200`
      case 'ERROR':
        return `${baseClasses} bg-red-100 text-red-800 ring-1 ring-red-200`
      case 'PROCESSING':
        return `${baseClasses} bg-blue-100 text-blue-800 ring-1 ring-blue-200`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 ring-1 ring-gray-200`
    }
  }

  const TableRow = ({ index, style }) => {
    const image = images[index]
    if (!image) return null

    const handleClick = () => {
      if (image.status === 'DUPLICATE_CONFIRMED') {
        onDuplicateCompare({ imageA: image, imageB: image.duplicate })
      } else {
        onImageSelect(image)
      }
    }

    const confidence = image.confidence || 0
    const processingTime = image.completion_time ?
      new Date(image.completion_time).toLocaleTimeString() : '-'

    return (
      <div
        style={style}
        className="flex items-center px-6 py-4 border-b border-gray-100 hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent cursor-pointer transition-all duration-200 group"
        onClick={handleClick}
      >
        {/* Status + Selection */}
        <div className="flex items-center space-x-4 w-20">
          <input
            type="checkbox"
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          {getStatusIcon(image.status)}
        </div>

        {/* Thumbnail */}
        <div className="w-16 h-12 mr-6 relative">
          {image.thumb_path ? (
            <img
              src={`/api/images/${image.id}/thumb`}
              alt="thumb"
              className="w-full h-full object-cover rounded-lg border border-gray-200 shadow-sm"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
              <FileImage className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border border-gray-200 flex items-center justify-center">
            {getStatusIcon(image.status)}
          </div>
        </div>

        {/* Filename */}
        <div className="flex-1 min-w-0 mr-6">
          <div className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
            {image.filename}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(image.created_ts).toLocaleDateString()}
          </div>
        </div>

        {/* Passport Number with Enhanced Visual */}
        <div className="w-64 mr-6">
          <div className="bg-gray-900 text-green-400 font-mono text-sm px-4 py-2 rounded-lg border shadow-sm">
            <div className="flex space-x-1">
              {(image.passport_number || 'N/A').split('').map((char, idx) => (
                <span
                  key={idx}
                  className={`inline-block w-6 h-6 text-center leading-6 rounded ${
                    image.per_char_conf && image.per_char_conf[idx] >= 90
                      ? 'bg-green-500/20 text-green-300'
                      : image.per_char_conf && image.per_char_conf[idx] >= 70
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="w-24 mr-6 text-center">
          <div className={`text-lg font-bold ${
            confidence >= 90 ? 'text-emerald-600' :
            confidence >= 80 ? 'text-amber-600' :
            'text-red-600'
          }`}>
            {confidence ? `${confidence.toFixed(0)}%` : 'N/A'}
          </div>
          <div className="text-xs text-gray-500">confidence</div>
        </div>

        {/* Status Badge */}
        <div className="w-40 mr-6">
          <span className={getStatusBadge(image.status, confidence)}>
            {image.status.replace('_', ' ')}
          </span>
        </div>

        {/* Processing Time */}
        <div className="w-24 text-right">
          <div className="text-sm text-gray-600">{processingTime}</div>
          <div className="text-xs text-gray-400">completed</div>
        </div>
      </div>
    )
  }

  const tableHeaders = (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 flex items-center px-6 py-4 text-sm font-semibold text-gray-700 sticky top-0 z-10">
      <div className="flex items-center space-x-4 w-20">
        <input
          type="checkbox"
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span>Status</span>
      </div>
      <div className="w-16 mr-6">Preview</div>
      <div className="flex-1 mr-6">Filename</div>
      <div className="w-64 mr-6">Passport Number</div>
      <div className="w-24 mr-6 text-center">Confidence</div>
      <div className="w-40 mr-6">Processing Status</div>
      <div className="w-24 text-right">Completed</div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading images...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white shadow-sm">
      {tableHeaders}
      {images.length > 0 ? (
        <div className="flex-1 overflow-hidden">
          <List
            height={window.innerHeight - 220}
            itemCount={images.length}
            itemSize={80}
            className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          >
            {TableRow}
          </List>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <FileImage className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <div className="text-lg text-gray-500">No images found</div>
            <div className="text-sm text-gray-400 mt-2">Upload a ZIP file to get started</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TableView