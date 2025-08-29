import React, { useState } from 'react'
import TopBar from './TopBar'
import TableView from './TableView'
import ReviewView from './ReviewView'
import DuplicateCompareView from './DuplicateCompareView'
import RightPanel from './RightPanel'
import UploadModal from './UploadModal'

const Workspace = () => {
  const [currentView, setCurrentView] = useState('table')
  const [selectedImage, setSelectedImage] = useState(null)
  const [duplicatePair, setDuplicatePair] = useState(null)
  const [showUpload, setShowUpload] = useState(false)

  const handleImageSelect = (image) => {
    setSelectedImage(image)
    setCurrentView('review')
  }

  const handleDuplicateCompare = (pair) => {
    setDuplicatePair(pair)
    setCurrentView('duplicate')
  }

  const handleBack = () => {
    setCurrentView('table')
    setSelectedImage(null)
    setDuplicatePair(null)
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'review':
        return <ReviewView image={selectedImage} onBack={handleBack} />
      case 'duplicate':
        return <DuplicateCompareView pair={duplicatePair} onBack={handleBack} />
      default:
        return <TableView onImageSelect={handleImageSelect} onDuplicateCompare={handleDuplicateCompare} />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex-1 flex flex-col">
        <TopBar onUpload={() => setShowUpload(true)} />
        <div className="flex-1 overflow-hidden">
          {renderCurrentView()}
        </div>
      </div>
      <RightPanel />
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </div>
  )
}

export default Workspace