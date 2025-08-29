import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.dirname(__dirname)

async function setup() {
  console.log('Setting up Smart Passport OCR application...')
  
  try {
    // Create necessary directories
    const directories = [
      'storage',
      'storage/originals',
      'storage/preproc', 
      'storage/thumbs',
      'temp',
      'temp/uploads',
      'data'
    ]
    
    for (const dir of directories) {
      const fullPath = path.join(rootDir, dir)
      await fs.ensureDir(fullPath)
      console.log(`✓ Created directory: ${dir}`)
    }
    
    // Create .env file if it doesn't exist
    const envPath = path.join(rootDir, '.env')
    const envExamplePath = path.join(rootDir, '.env.example')
    
    if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
      await fs.copy(envExamplePath, envPath)
      console.log('✓ Created .env file from .env.example')
    }
    
    console.log('\nSetup completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Review and update the .env file with your configuration')
    console.log('2. Ensure Ollama is running with your vision model')
    console.log('3. Start the application with: npm start')
    
  } catch (error) {
    console.error('Setup failed:', error)
    process.exit(1)
  }
}

setup()