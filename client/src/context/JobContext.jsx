import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const JobContext = createContext()

export const useJob = () => {
  const context = useContext(JobContext)
  if (!context) {
    throw new Error('useJob must be used within a JobProvider')
  }
  return context
}

export const JobProvider = ({ children }) => {
  const [jobs, setJobs] = useState([])
  const [activeJob, setActiveJob] = useState(null)
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)

  // Load jobs on mount
  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/jobs')
      setJobs(response.data || [])
      
      // Set first job as active if none selected
      if (!activeJob && response.data && response.data.length > 0) {
        setActiveJob(response.data[0])
      }
    } catch (error) {
      console.error('Error loading jobs:', error)
      setJobs([])
    } finally {
      setLoading(false)
    }
  }

  const loadImages = useCallback(async (jobId) => {
    if (!jobId) {
      setImages([])
      return
    }

    try {
      setLoading(true)
      const response = await axios.get(`/api/jobs/${jobId}/images`)
      setImages(response.data || [])
    } catch (error) {
      console.error('Error loading images:', error)
      setImages([])
    } finally {
      setLoading(false)
    }
  }, [])

  const createJob = async (name, description = '') => {
    try {
      const response = await axios.post('/api/jobs', {
        name: name.trim(),
        description: description.trim()
      })
      
      const newJob = response.data
      setJobs(prev => [newJob, ...prev])
      setActiveJob(newJob)
      return newJob
    } catch (error) {
      console.error('Error creating job:', error)
      throw error
    }
  }

  const updateJob = async (jobId, updates) => {
    try {
      const response = await axios.put(`/api/jobs/${jobId}`, updates)
      const updatedJob = response.data
      
      setJobs(prev => prev.map(job => 
        job.id === jobId ? updatedJob : job
      ))
      
      if (activeJob?.id === jobId) {
        setActiveJob(updatedJob)
      }
      
      return updatedJob
    } catch (error) {
      console.error('Error updating job:', error)
      throw error
    }
  }

  const deleteJob = async (jobId) => {
    try {
      await axios.delete(`/api/jobs/${jobId}`)
      
      setJobs(prev => prev.filter(job => job.id !== jobId))
      
      if (activeJob?.id === jobId) {
        setActiveJob(jobs.find(job => job.id !== jobId) || null)
      }
    } catch (error) {
      console.error('Error deleting job:', error)
      throw error
    }
  }

  const value = {
    jobs,
    activeJob,
    images,
    loading,
    setActiveJob,
    loadJobs,
    loadImages,
    createJob,
    updateJob,
    deleteJob
  }

  return (
    <JobContext.Provider value={value}>
      {children}
    </JobContext.Provider>
  )
}