import os from 'os'

export class MetricsService {
  constructor() {
    this.startTime = Date.now()
    this.processedCount = 0
    this.errorCount = 0
  }
  
  getCurrentMetrics() {
    const cpuUsage = this.getCPUUsage()
    const memUsage = process.memoryUsage()
    const totalMem = os.totalmem()
    
    return {
      cpu: Math.round(cpuUsage * 100),
      ram: Math.round((memUsage.rss / totalMem) * 100),
      gpu: 0, // Would be implemented with actual GPU monitoring
      queueDepths: {
        preprocess: 0, // Would be populated from pipeline
        ocr: 0,
        fusion: 0,
        post: 0
      },
      throughput: this.calculateThroughput(),
      processed: this.processedCount,
      errors: this.errorCount,
      uptime: Date.now() - this.startTime
    }
  }
  
  getCPUUsage() {
    const cpus = os.cpus()
    let totalIdle = 0
    let totalTick = 0
    
    cpus.forEach(cpu => {
      Object.keys(cpu.times).forEach(type => {
        totalTick += cpu.times[type]
      })
      totalIdle += cpu.times.idle
    })
    
    return 1 - (totalIdle / totalTick)
  }
  
  calculateThroughput() {
    const uptimeMinutes = (Date.now() - this.startTime) / 60000
    return uptimeMinutes > 0 ? Math.round(this.processedCount / uptimeMinutes) : 0
  }
  
  incrementProcessed() {
    this.processedCount++
  }
  
  incrementErrors() {
    this.errorCount++
  }
}