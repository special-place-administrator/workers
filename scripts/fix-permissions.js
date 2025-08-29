import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function fixPermissions() {
  console.log('Fixing file permissions and creating required directories...')
  
  try {
    const baseDir = '/var/www/smart-passport-ocr'
    
    // Create necessary directories with correct permissions
    const directories = [
      'data',
      'storage',
      'storage/originals',
      'storage/preproc', 
      'storage/thumbs',
      'temp',
      'temp/uploads',
      'logs'
    ]
    
    for (const dir of directories) {
      const fullPath = path.join(baseDir, dir)
      await fs.ensureDir(fullPath)
      console.log(`✓ Created directory: ${fullPath}`)
    }
    
    // Create systemd service file
    const serviceContent = `[Unit]
Description=Smart Passport OCR Service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/smart-passport-ocr
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=smart-passport-ocr

[Install]
WantedBy=multi-user.target
`

    await fs.writeFile('/etc/systemd/system/smart-passport-ocr.service', serviceContent)
    console.log('✓ Created systemd service file')
    
    // Create nginx configuration
    const nginxConfig = `server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # WebSocket for real-time updates
    location /ws {
        proxy_pass http://127.0.0.1:8001/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Static files
    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
`

    await fs.writeFile('/etc/nginx/sites-available/smart-passport-ocr', nginxConfig)
    console.log('✓ Created nginx configuration')
    
    console.log('\nSetup completed! Next steps:')
    console.log('1. sudo ln -sf /etc/nginx/sites-available/smart-passport-ocr /etc/nginx/sites-enabled/')
    console.log('2. sudo nginx -t')
    console.log('3. sudo systemctl reload nginx')
    console.log('4. sudo systemctl daemon-reload')
    console.log('5. sudo systemctl enable smart-passport-ocr')
    console.log('6. sudo systemctl restart smart-passport-ocr')
    
  } catch (error) {
    console.error('Setup failed:', error)
    process.exit(1)
  }
}

fixPermissions()