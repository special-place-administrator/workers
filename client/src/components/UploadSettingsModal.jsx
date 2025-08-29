import React, { useState, useEffect } from 'react'
import { X, Settings, Save, RotateCcw, Calculator, Info } from 'lucide-react'
import axios from 'axios'

const UploadSettingsModal = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/upload/settings')
      setSettings(response.data)
    } catch (error) {
      console.error('Error loading upload settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      await axios.post('/api/upload/settings', settings)
      alert('Upload settings saved successfully!')
    } catch (error) {
      console.error('Error saving upload settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    setSettings({
      // Expected image parameters
      upload_expected_width: 200,
      upload_expected_height: 500,
      upload_expected_file_size: 3072, // 3KB in bytes
      
      // Tolerance percentages
      upload_dimension_tolerance: 20, // 20% tolerance for dimensions
      upload_file_size_tolerance: 25, // 25% tolerance for file size
      upload_aspect_ratio_tolerance: 15, // 15% tolerance for aspect ratio
      
      // Absolute limits (safety bounds)
      upload_min_file_size: 512, // 512 bytes minimum
      upload_max_file_size: 10485760, // 10MB maximum
      upload_min_dimension: 10, // 10px minimum
      upload_max_dimension: 5000, // 5000px maximum
    })
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  // Calculate derived values for display
  const expectedWidth = settings.upload_expected_width || 200
  const expectedHeight = settings.upload_expected_height || 500
  const expectedFileSize = settings.upload_expected_file_size || 3072
  const dimensionTolerance = settings.upload_dimension_tolerance || 20
  const fileSizeTolerance = settings.upload_file_size_tolerance || 25
  const aspectRatioTolerance = settings.upload_aspect_ratio_tolerance || 15

  const expectedAspectRatio = expectedWidth / expectedHeight
  const minWidth = Math.round(expectedWidth * (1 - dimensionTolerance / 100))
  const maxWidth = Math.round(expectedWidth * (1 + dimensionTolerance / 100))
  const minHeight = Math.round(expectedHeight * (1 - dimensionTolerance / 100))
  const maxHeight = Math.round(expectedHeight * (1 + dimensionTolerance / 100))
  const minFileSize = Math.round(expectedFileSize * (1 - fileSizeTolerance / 100))
  const maxFileSize = Math.round(expectedFileSize * (1 + fileSizeTolerance / 100))
  const minAspectRatio = expectedAspectRatio * (1 - aspectRatioTolerance / 100)
  const maxAspectRatio = expectedAspectRatio * (1 + aspectRatioTolerance / 100)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Upload Validation Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-600">Loading settings...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Configuration */}
              <div className="space-y-6">
                {/* Expected Image Parameters */}
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-4 flex items-center space-x-2">
                    <Calculator className="w-5 h-5" />
                    <span>Expected Image Parameters</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-2">
                          Expected Width (pixels)
                        </label>
                        <input
                          type="number"
                          value={expectedWidth}
                          onChange={(e) => updateSetting('upload_expected_width', parseInt(e.target.value) || 0)}
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="10"
                          max="5000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-800 mb-2">
                          Expected Height (pixels)
                        </label>
                        <input
                          type="number"
                          value={expectedHeight}
                          onChange={(e) => updateSetting('upload_expected_height', parseInt(e.target.value) || 0)}
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          min="10"
                          max="5000"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-2">
                        Expected File Size (KB)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={(expectedFileSize / 1024).toFixed(1)}
                        onChange={(e) => updateSetting('upload_expected_file_size', Math.round(parseFloat(e.target.value) * 1024) || 0)}
                        className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0.1"
                        max="10240"
                      />
                      <div className="text-xs text-blue-600 mt-1">
                        {expectedFileSize} bytes
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tolerance Settings */}
                <div className="bg-amber-50 p-6 rounded-lg border border-amber-200">
                  <h3 className="font-semibold text-amber-900 mb-4">Tolerance Settings (%)</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-amber-800 mb-2">
                        Dimension Tolerance: {dimensionTolerance}%
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={dimensionTolerance}
                        onChange={(e) => updateSetting('upload_dimension_tolerance', parseInt(e.target.value))}
                        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="text-xs text-amber-600 mt-1">
                        Width: {minWidth}-{maxWidth}px, Height: {minHeight}-{maxHeight}px
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-amber-800 mb-2">
                        File Size Tolerance: {fileSizeTolerance}%
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        value={fileSizeTolerance}
                        onChange={(e) => updateSetting('upload_file_size_tolerance', parseInt(e.target.value))}
                        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="text-xs text-amber-600 mt-1">
                        Size: {(minFileSize / 1024).toFixed(1)}-{(maxFileSize / 1024).toFixed(1)}KB
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-amber-800 mb-2">
                        Aspect Ratio Tolerance: {aspectRatioTolerance}%
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={aspectRatioTolerance}
                        onChange={(e) => updateSetting('upload_aspect_ratio_tolerance', parseInt(e.target.value))}
                        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="text-xs text-amber-600 mt-1">
                        Ratio: {minAspectRatio.toFixed(2)}-{maxAspectRatio.toFixed(2)} (expected: {expectedAspectRatio.toFixed(2)})
                      </div>
                    </div>
                  </div>
                </div>

                {/* Safety Limits */}
                <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                  <h3 className="font-semibold text-red-900 mb-4">Absolute Safety Limits</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-red-800 mb-2">
                        Min File Size (bytes)
                      </label>
                      <input
                        type="number"
                        value={settings.upload_min_file_size || 512}
                        onChange={(e) => updateSetting('upload_min_file_size', parseInt(e.target.value) || 512)}
                        className="w-full border border-red-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-red-800 mb-2">
                        Max File Size (MB)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={((settings.upload_max_file_size || 10485760) / 1024 / 1024).toFixed(1)}
                        onChange={(e) => updateSetting('upload_max_file_size', Math.round(parseFloat(e.target.value) * 1024 * 1024) || 10485760)}
                        className="w-full border border-red-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        min="0.1"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-red-800 mb-2">
                        Min Dimension (px)
                      </label>
                      <input
                        type="number"
                        value={settings.upload_min_dimension || 10}
                        onChange={(e) => updateSetting('upload_min_dimension', parseInt(e.target.value) || 10)}
                        className="w-full border border-red-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-red-800 mb-2">
                        Max Dimension (px)
                      </label>
                      <input
                        type="number"
                        value={settings.upload_max_dimension || 5000}
                        onChange={(e) => updateSetting('upload_max_dimension', parseInt(e.target.value) || 5000)}
                        className="w-full border border-red-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        min="100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Validation Preview */}
              <div className="space-y-6">
                {/* Current Validation Rules */}
                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-900 mb-4 flex items-center space-x-2">
                    <Info className="w-5 h-5" />
                    <span>Current Validation Rules</span>
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="bg-white p-3 rounded border-l-4 border-green-500">
                      <div className="font-medium text-green-800">✅ Accepted Images:</div>
                      <div className="text-green-700 mt-1 space-y-1">
                        <div>• Dimensions: {minWidth}×{minHeight} to {maxWidth}×{maxHeight} pixels</div>
                        <div>• File Size: {(minFileSize / 1024).toFixed(1)} to {(maxFileSize / 1024).toFixed(1)} KB</div>
                        <div>• Aspect Ratio: {minAspectRatio.toFixed(2)} to {maxAspectRatio.toFixed(2)}</div>
                        <div>• Formats: JPEG, PNG, BMP, TIFF</div>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded border-l-4 border-red-500">
                      <div className="font-medium text-red-800">❌ Rejected Images:</div>
                      <div className="text-red-700 mt-1 space-y-1">
                        <div>• Wrong dimensions (outside tolerance)</div>
                        <div>• Wrong file size (outside tolerance)</div>
                        <div>• Wrong aspect ratio (shape mismatch)</div>
                        <div>• Corrupt or unreadable files</div>
                        <div>• Unsupported formats</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Example Scenarios */}
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Example Test Cases</h3>
                  
                  <div className="space-y-3 text-sm">
                    {[
                      { name: "Perfect Match", width: expectedWidth, height: expectedHeight, size: expectedFileSize / 1024, valid: true },
                      { name: "Slightly Larger", width: Math.round(expectedWidth * 1.1), height: Math.round(expectedHeight * 1.1), size: (expectedFileSize * 1.15) / 1024, valid: true },
                      { name: "Too Big", width: Math.round(expectedWidth * 1.5), height: Math.round(expectedHeight * 1.5), size: (expectedFileSize * 2) / 1024, valid: false },
                      { name: "Wrong Ratio (Square)", width: expectedWidth, height: expectedWidth, size: expectedFileSize / 1024, valid: false },
                      { name: "Landscape Version", width: expectedHeight, height: expectedWidth, size: expectedFileSize / 1024, valid: expectedHeight/expectedWidth >= minAspectRatio && expectedHeight/expectedWidth <= maxAspectRatio }
                    ].map((example, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-2 rounded ${example.valid ? 'bg-green-100' : 'bg-red-100'}`}>
                        <div>
                          <div className="font-medium">{example.name}</div>
                          <div className="text-xs text-gray-600">
                            {example.width}×{example.height}px, {example.size.toFixed(1)}KB
                          </div>
                        </div>
                        <div className={`text-sm font-medium ${example.valid ? 'text-green-600' : 'text-red-600'}`}>
                          {example.valid ? '✅ PASS' : '❌ REJECT'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tips */}
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-3">💡 Configuration Tips</h3>
                  <div className="text-sm text-blue-800 space-y-2">
                    <div>• <strong>Dimension Tolerance:</strong> 20% allows minor variations in cropping</div>
                    <div>• <strong>File Size Tolerance:</strong> 25% accounts for compression differences</div>
                    <div>• <strong>Aspect Ratio:</strong> 15% handles slight perspective distortion</div>
                    <div>• <strong>Portrait vs Landscape:</strong> System detects orientation automatically</div>
                    <div>• <strong>Safety Limits:</strong> Hard boundaries to prevent system abuse</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={resetToDefaults}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to Defaults</span>
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all font-medium"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UploadSettingsModal