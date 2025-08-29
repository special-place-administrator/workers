import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './Header'
import MainWorkspace from './MainWorkspace'
import RightPanel from './RightPanel'
import UploadModal from './UploadModal'
import { useJob } from '../context/JobContext'

const MainLayout = () => {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const { activeJob, loadImages } = useJob()

  const handleUploadComplete = () => {
    // Refresh the current job's images after successful upload
    if (activeJob) {
      loadImages(activeJob.id)
    }
    // Close modal after a short delay to show success message
    setTimeout(() => {
      setUploadModalOpen(false)
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <Header onUploadClick={() => setUploadModalOpen(true)} />
      
      <div className="flex-1 flex overflow-hidden">
        <MainWorkspace />
        <RightPanel />
      </div>

      <UploadModal 
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        activeJob={activeJob}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  )
}

export default MainLayout