import sqlite3 from 'sqlite3'
import path from 'path'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let db = null

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export async function initDatabase() {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'passport_ocr.db')
  
  // Ensure data directory exists
  await fs.ensureDir(path.dirname(dbPath))
  
  console.log('Initializing database at:', dbPath)
  
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err)
      throw err
    }
    console.log('Connected to SQLite database')
  })
  
  // Enable WAL mode for better concurrency
  db.run('PRAGMA journal_mode=WAL')
  db.run('PRAGMA synchronous=NORMAL')
  db.run('PRAGMA cache_size=10000')
  db.run('PRAGMA temp_store=MEMORY')
  
  await createTables()
  await seedDefaultSettings()
  
  return db
}

function createTables() {
  return new Promise((resolve, reject) => {
    const schema = `
      -- Jobs table
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'CREATED',
        image_count INTEGER DEFAULT 0,
        created_ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_ts DATETIME,
        completed_ts DATETIME
      );

      -- Images table  
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_path TEXT NOT NULL,
        preproc_path TEXT,
        thumb_path TEXT,
        file_size INTEGER,
        phash TEXT,
        upload_ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'UPLOADED',
        created_ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
      );

      -- Results table with enhanced character-level data
      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        passport_number TEXT,
        per_char_conf TEXT, -- JSON array of per-character confidence scores
        per_char_src TEXT,  -- JSON array of per-character sources
        confidence INTEGER DEFAULT 0,
        status TEXT DEFAULT 'PROCESSING',
        reasons TEXT,
        raw_response TEXT,
        enhancement_profile TEXT,
        damage_flags TEXT,    -- JSON array of damage flags
        fusion_method TEXT,
        sources_used TEXT,    -- JSON array of OCR sources used
        valid_positions INTEGER DEFAULT 0,
        ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        completion_time DATETIME,
        FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
      );

      -- Duplicates table
      CREATE TABLE IF NOT EXISTS duplicates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id_a TEXT NOT NULL,
        image_id_b TEXT NOT NULL,
        hamming INTEGER DEFAULT 0,
        text_distance REAL DEFAULT 0.0,
        confirmed BOOLEAN DEFAULT FALSE,
        created_ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id_a) REFERENCES images (id) ON DELETE CASCADE,
        FOREIGN KEY (image_id_b) REFERENCES images (id) ON DELETE CASCADE,
        UNIQUE(image_id_a, image_id_b)
      );

      -- Manual corrections table
      CREATE TABLE IF NOT EXISTS manual_corrections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id TEXT NOT NULL,
        original_number TEXT,
        corrected_number TEXT NOT NULL,
        per_char_edits TEXT, -- JSON array of character-level edits
        correction_reason TEXT,
        corrected_by TEXT,
        corrected_ts DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE
      );

      -- Settings table
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_ts DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_images_job_id ON images(job_id);
      CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);
      CREATE INDEX IF NOT EXISTS idx_results_image_id ON results(image_id);
      CREATE INDEX IF NOT EXISTS idx_results_job_id ON results(job_id);
      CREATE INDEX IF NOT EXISTS idx_results_status ON results(status);
      CREATE INDEX IF NOT EXISTS idx_results_passport_number ON results(passport_number);
      CREATE INDEX IF NOT EXISTS idx_duplicates_images ON duplicates(image_id_a, image_id_b);
      CREATE INDEX IF NOT EXISTS idx_corrections_image_id ON manual_corrections(image_id);
    `

    db.exec(schema, (err) => {
      if (err) {
        console.error('Error creating database tables:', err)
        reject(err)
      } else {
        console.log('Database tables created successfully')
        resolve()
      }
    })
  })
}

async function seedDefaultSettings() {
  const defaultSettings = {
    // Model Configuration
    'modelUrl': 'http://10.4.0.15:11434',
    'modelName': 'benhaotang/Nanonets-OCR-s:latest',
    'keepAlive': '5m',
    'parallelRequests': 2,
    'requestTimeout': 30000,
    
    // Enhanced Vision Prompt for new pattern
    'visionPrompt': 'Extract the passport number from this image. The passport number can be in one of these formats: 1) Single letter C, D, E, or S followed by 8 digits (e.g., C12345678), or 2) Two letters from C, D, E, S, N followed by 7 digits (e.g., CD1234567). Return only JSON: {"passport_number": "C12345678", "confidence": 85}',
    
    // Enhancement Settings
    'enhancement': 'standard',
    'targetHeight': 90,
    'contrastBoost': 1.5,
    'sharpenAmount': 1.0,
    'denoiseStrength': 0.5,
    
    // OCR Processing with new pattern
    'confThreshold': 80,
    'patternRegex': '^(?:(?:[CDES][0-9]{8})|(?:[CDESN]{2}[0-9]{7}))$',
    'forceParseIndex': false,
    'parseIndex': 0,
    
    // Duplicate Detection
    'dupPhashThreshold': 10,
    'textDistanceThreshold': 0.8,
    'autoConfirmDuplicates': false,
    
    // System Performance
    'preprocessWorkers': 2,
    'ocrWorkers': 2,
    'ramTargetPct': 60,
    'maxQueueSize': 1000,
    
    // Database & Storage
    'databaseType': 'sqlite',
    'storageRoot': './storage',
    'enableWalMode': true,
    'backupInterval': 24,
    
    // Security & Access
    'enableAuth': false,
    'sessionTimeout': 8,
    'allowedIPs': '',
    'logLevel': 'info'
  }

  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
    
    for (const [key, value] of Object.entries(defaultSettings)) {
      stmt.run(key, JSON.stringify(value))
    }
    
    stmt.finalize((err) => {
      if (err) {
        console.error('Error seeding default settings:', err)
        reject(err)
      } else {
        console.log('Default settings initialized')
        resolve()
      }
    })
  })
}

export async function closeDatabase() {
  if (db) {
    return new Promise((resolve) => {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err)
        } else {
          console.log('Database connection closed')
        }
        resolve()
      })
    })
  }
}