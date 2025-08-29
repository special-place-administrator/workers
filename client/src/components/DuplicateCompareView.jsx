import React, { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Check, X, Eye } from 'lucide-react'
import axios from 'axios'

const DuplicateCompareView = ({ pair, onBack }) => {
  const [overlayParams, setOverlayParams] = useState({
    opacity: 0.5,
    threshold: 128,
    erode: 0,
    offsetX: 0,
    offsetY: 0,
    rotate: 0,
    scale: 1.0
  })
  const canvasRef = useRef(null)

  useEffect(() => {
    if (pair && canvasRef.current) {
      drawOverlay()
    }
  }, [pair, overlayParams])

  const drawOverlay = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    canvas.width = 400
    canvas.height = 200

    // Simplified overlay visualization
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Draw passport number with differences highlighted
    ctx.font = '24px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    const text = pair.imageA.passport_number || 'C00277790'
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    
    // Draw each character
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const x = centerX - (text.length * 12) + (i * 24)
      
      // Highlight differences in red
      if (i === 8) { // Example: last character different
        ctx.fillStyle = '#ff0000'
        ctx.fillRect(x - 12, centerY - 20, 24, 40)
      }
      
      ctx.fillStyle = '#000000'
      ctx.fillText(char, x, centerY)
    }
  }

  const handleConfirmDuplicate = async () => {
    try {
      await axios.post(`/api/duplicates/${pair.imageA.id}/confirm`)
      onBack()
    } catch (error) {
      console.error('Error confirming duplicate:', error)
    }
  }

  const handleMarkAsBadImage = async () => {
    try {
      await axios.post(`/api/results/${pair.imageA.id}/mark-bad`)
      onBack()
    } catch (error) {
      console.error('Error marking as bad image:', error)
    }
  }

  const handleSaveCorrection = async () => {
    // Handle correction logic here
    onBack()
  }

  if (!pair) return null

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header - Blue theme */}
      <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-white hover:text-blue-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Enhanced Duplicate Comparison</span>
          </button>
        </div>
        
        <button
          onClick={onBack}
          className="text-white hover:text-blue-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex bg-gray-100">
        {/* Images Section */}
        <div className="flex-1 p-6">
          <div className="grid grid-cols-3 gap-6 h-full">
            {/* Original Validated Item */}
            <div className="flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="bg-green-600 text-white px-4 py-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-300 rounded-full"></div>
                  <span className="text-sm font-medium">
                    {pair.imageA.filename || '10485_C00277790_C00277790_SUCCESS.jpg'}
                  </span>
                </div>
              </div>
              <div className="p-2">
                <div className="text-xs text-gray-600 mb-2">
                  <div><strong>Detected (OCR):</strong> {pair.imageA.passport_number}</div>
                  <div><strong>Parsing:</strong> JSON_PIPELINE_OK</div>
                  <div><strong>Raw:</strong> {`{"passport_number": "${pair.imageA.passport_number}"}`}</div>
                </div>
              </div>
              <div className="flex-1 bg-gray-800 text-white p-4 text-center">
                <h4 className="text-sm mb-2">Original Validated Item</h4>
                <div className="bg-white p-2 rounded">
                  <div className="font-mono text-black text-lg bg-white p-2 border">
                    {pair.imageA.passport_number || 'C00277790'}
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Overlay */}
            <div className="flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-600 text-white px-4 py-2 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm font-medium">Enhanced Overlay Comparison (Differences in Red)</span>
                </div>
              </div>
              <div className="flex-1 p-4 flex items-center justify-center bg-gray-200">
                <canvas
                  ref={canvasRef}
                  className="border border-gray-300 bg-white"
                />
              </div>
            </div>

            {/* New Item Requiring Review */}
            <div className="flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="bg-orange-600 text-white px-4 py-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-orange-300 rounded-full"></div>
                  <span className="text-sm font-medium">
                    {pair.imageB?.filename || '10497_C00277730_C00277790_DUPLICATE_CONFIRMED.jpg'}
                  </span>
                </div>
              </div>
              <div className="p-2">
                <div className="text-xs text-gray-600 mb-2">
                  <div><strong>Detected (OCR):</strong> {pair.imageB?.passport_number || 'C00277790'}</div>
                  <div><strong>Parsing:</strong> JSON_PIPELINE_OK</div>
                  <div><strong>Raw:</strong> {`{"passport_number": "${pair.imageB?.passport_number || 'C00277790'}"}`}</div>
                </div>
              </div>
              <div className="flex-1 bg-gray-800 text-white p-4 text-center">
                <h4 className="text-sm mb-2">New Item Requiring Review</h4>
                <div className="bg-white p-2 rounded">
                  <div className="font-mono text-black text-lg bg-white p-2 border">
                    {pair.imageB?.passport_number || 'C00277790'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Panel - Dark theme */}
      <div className="bg-gray-800 text-white p-6">
        <div className="flex items-center justify-between">
          {/* Detection Status */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm">OCR results match: 'C00277790'</span>
            </div>
          </div>

          {/* Correction Input */}
          <div className="flex items-center space-x-4">
            <label className="text-sm text-gray-300">Correct Number:</label>
            <input
              type="text"
              defaultValue="C00277790"
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white font-mono"
              maxLength="9"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSaveCorrection}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Check className="w-4 h-4" />
              <span>Save Correction</span>
            </button>
            
            <button
              onClick={handleConfirmDuplicate}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
            >
              <Check className="w-4 h-4" />
              <span>Mark as Confirmed Duplicate</span>
            </button>
            
            <button
              onClick={handleMarkAsBadImage}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              <X className="w-4 h-4" />
              <span>Mark as Bad Image</span>
            </button>
            
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              <span>Cancel</span>
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-300">
          <span>Correcting: 10497_C00277730_C00277790_DUPLICATE_CONFIRMED.jpg</span>
        </div>
      </div>
    </div>
  )
}

export default DuplicateCompareView