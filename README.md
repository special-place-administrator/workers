# Smart Passport OCR Web Application

A comprehensive web-based OCR system for batch processing passport images with operator review workstation.

## Features

- **Batch Upload**: Resumable ZIP upload with progress tracking
- **Processing Pipeline**: 4-stage bounded queues (preprocess → OCR → fusion → post-processing)
- **Operator Workstation**: Auto-accept high confidence, route unclear items for review
- **Duplicate Detection**: Visual overlay comparison with pHash and text similarity
- **Multi-operator Support**: Pause/resume, reprocessing, full audit trail
- **Real-time Updates**: WebSocket-based live metrics and progress

## System Requirements

- Node.js 18+ 
- Ubuntu 20.04+ (for deployment)
- NGINX (for reverse proxy)
- Ollama or compatible vision model endpoint
- 4GB+ RAM recommended
- SSD storage for image processing

## Quick Start

### 1. Install Dependencies

```bash
# Install all dependencies
npm run install:all

# Setup directories and configuration
npm run setup
```

### 2. Configure Model Endpoint

Edit `.env` file:
```bash
MODEL_URL=http://localhost:11434
MODEL_NAME=llava
```

### 3. Development

```bash
# Start development servers
npm run dev

# Or start components separately
npm run dev:server  # Backend on :8000
npm run dev:client  # Frontend on :3000
```

### 4. Production Build

```bash
# Build frontend
npm run build

# Start production server
npm start
```

## Ubuntu Server Deployment

### 1. Install Node.js and Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install build tools
sudo apt-get install -y build-essential python3-dev

# Clone and setup application
git clone <your-repo> /var/www/smart-passport-ocr
cd /var/www/smart-passport-ocr
npm run install:all
npm run setup
npm run build
```

### 2. Install and Configure NGINX

```bash
# Install NGINX
sudo apt install nginx -y

# Copy configuration
sudo cp nginx.conf /etc/nginx/sites-available/smart-passport-ocr
sudo ln -s /etc/nginx/sites-available/smart-passport-ocr /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Create System Service

```bash
# Create service file
sudo tee /etc/systemd/system/smart-passport-ocr.service > /dev/null <<EOF
[Unit]
Description=Smart Passport OCR
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/smart-passport-ocr
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable smart-passport-ocr
sudo systemctl start smart-passport-ocr
sudo systemctl status smart-passport-ocr
```

### 4. Install Vision Model (Ollama)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull vision model
ollama pull llava

# Verify model is running
curl http://localhost:11434/api/tags
```

## Configuration

### Environment Variables

```bash
# Server Configuration
PORT=8000
NODE_ENV=production

# Model Configuration  
MODEL_URL=http://localhost:11434
MODEL_NAME=llava

# Processing Configuration
PREPROC_WORKERS=2
OCR_WORKERS=2
RAM_TARGET_PCT=60
CONF_THRESHOLD=80

# Duplicate Detection
DUP_PHASH_THRESHOLD=10
TEXT_DISTANCE_THRESHOLD=0.8

# Pattern Matching
PATTERN_REGEX=^[A-Z0-9]{9}$
```

### Directory Structure

```
/var/www/smart-passport-ocr/
├── client/                 # React frontend
├── server/                 # Node.js backend
├── data/                   # SQLite database
├── storage/               # Content-addressed storage
│   ├── originals/         # Original images
│   ├── preproc/           # Preprocessed images  
│   └── thumbs/            # Thumbnails
├── uploads/               # Temporary upload chunks
└── logs/                  # Application logs
```

## Usage

### 1. Create Job and Upload Images

1. Access the web interface at `http://your-server/`
2. Create a new job in the right panel
3. Click "Upload" and select a ZIP file containing passport images
4. Monitor upload progress

### 2. Start Processing

1. Select the job from the right panel
2. Click "Start" in the top bar
3. Monitor real-time progress and metrics
4. View processed results in the table

### 3. Review and Correct

1. Click on items with "Review Required" status
2. Review side-by-side original and preprocessed images
3. Correct passport numbers using individual character inputs
4. Save corrections or reprocess with different settings

### 4. Handle Duplicates

1. Click on items with "Duplicate Confirmed" status  
2. Use overlay controls to compare images visually
3. Confirm or reject duplicate status
4. Adjust overlay parameters for better comparison

## API Documentation

### Core Endpoints

```bash
# Upload Management
POST /api/upload/init       # Initialize resumable upload
POST /api/upload/chunk      # Upload file chunk
POST /api/upload/complete   # Complete upload and extract

# Job Management  
GET  /api/jobs             # List all jobs
POST /api/jobs             # Create new job
POST /api/jobs/:id/start   # Start job processing
POST /api/jobs/:id/pause   # Pause job processing
POST /api/jobs/:id/stop    # Stop job processing

# Image and Results
GET  /api/jobs/:id/images  # Get job images with filters
GET  /api/images/:id/:type # Serve image content (original/preproc/thumb)
GET  /api/results/:id      # Get processing result
POST /api/results/:id/correct    # Save manual correction
POST /api/results/:id/reprocess  # Reprocess with new settings

# Duplicate Management
GET  /api/duplicates/:id   # Get duplicate candidates
POST /api/duplicates/:id/confirm # Confirm duplicate
POST /api/duplicates/:id/reject  # Reject duplicate

# Configuration
GET  /api/settings         # Get current settings
POST /api/settings         # Update settings
```

### WebSocket Events

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8000/ws')

// Receive real-time updates
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  switch(data.type) {
    case 'metrics':
      // CPU, RAM, GPU usage, queue depths, throughput
      break
    case 'job_progress':  
      // Job processing progress updates
      break
    case 'result_update':
      // New OCR results available
      break
  }
}
```

## Troubleshooting

### Common Issues

1. **Upload Fails**
   - Check disk space in `/var/www/smart-passport-ocr/uploads`
   - Verify NGINX client_max_body_size setting
   - Check file permissions for www-data user

2. **OCR Model Not Responding**
   - Verify Ollama is running: `sudo systemctl status ollama`
   - Test model endpoint: `curl http://localhost:11434/api/tags`
   - Check model name in `.env` matches available models

3. **Processing Stuck**
   - Check system resources: `htop`
   - Review application logs: `sudo journalctl -u smart-passport-ocr -f`
   - Restart processing pipeline: `sudo systemctl restart smart-passport-ocr`

4. **Database Issues**
   - Check SQLite file permissions in `data/` directory
   - Backup and recreate database if corrupted
   - Review database logs for lock conflicts

### Performance Tuning

```bash
# Adjust worker counts based on CPU cores
PREPROC_WORKERS=4
OCR_WORKERS=2

# Increase RAM target for larger batches  
RAM_TARGET_PCT=80

# Optimize NGINX for large uploads
client_max_body_size 1G;
proxy_buffering off;
proxy_request_buffering off;
```

### Monitoring

```bash
# Check application status
sudo systemctl status smart-passport-ocr

# View logs
sudo journalctl -u smart-passport-ocr -f

# Monitor resources
htop
iotop
df -h
```

## Security Considerations

- Internal network deployment recommended
- Configure firewall to block external access except through NGINX
- Regular backup of database and storage directories
- Monitor disk usage for uploaded images
- Review and rotate logs regularly

## Maintenance

### Regular Tasks

```bash
# Backup database
cp /var/www/smart-passport-ocr/data/passport_ocr.db /backup/

# Clean old uploads (run weekly)
find /var/www/smart-passport-ocr/uploads -type f -mtime +7 -delete

# Rotate logs
sudo logrotate /etc/logrotate.d/smart-passport-ocr

# Update dependencies (test first)
npm audit && npm audit fix
```

### Scaling Considerations

- Use PostgreSQL for multi-server deployments
- Implement Redis for job queues in clustered setup  
- Consider GPU acceleration for OCR processing
- Load balance multiple application instances
- Separate storage to shared filesystem (NFS/GlusterFS)

## License

MIT License - see LICENSE file for details
</buildAction>

<bindAction type="file" filePath="DEPLOYMENT.md"># Smart Passport OCR - Ubuntu Server Deployment Guide

Complete step-by-step guide for deploying Smart Passport OCR on Ubuntu server with NGINX.

## Prerequisites

- Ubuntu 20.04+ server with sudo access
- Minimum 4GB RAM, 20GB storage
- Domain name or IP address for access

## Step 1: System Preparation

### Update System
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip build-essential
```

### Install Node.js 18
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version
```

### Create Application User
```bash
# Create dedicated user for the application
sudo useradd -r -s /bin/false -d /var/www/smart-passport-ocr smartocr

# Create application directory
sudo mkdir -p /var/www/smart-passport-ocr
sudo chown smartocr:smartocr /var/www/smart-passport-ocr
```

## Step 2: Application Installation

### Download and Setup Application
```bash
# Navigate to application directory
cd /var/www/smart-passport-ocr

# Download the project files
# Option 1: If you have the files as a zip
wget YOUR_PROJECT_ZIP_URL
unzip smart-passport-ocr.zip
mv smart-passport-ocr/* .

# Option 2: Clone from repository
# git clone https://github.com/yourusername/smart-passport-ocr.git .

# Install dependencies
npm run install:all

# Setup directories and configuration
npm run setup

# Build production version
npm run build

# Set correct ownership
sudo chown -R smartocr:smartocr /var/www/smart-passport-ocr
```

### Configure Environment
```bash
# Edit environment configuration
sudo nano /var/www/smart-passport-ocr/.env
```

Update the following settings:
```bash
# Server Configuration
PORT=8000
NODE_ENV=production

# Model Configuration
MODEL_URL=http://localhost:11434
MODEL_NAME=llava

# Processing Configuration
PREPROC_WORKERS=2
OCR_WORKERS=2
RAM_TARGET_PCT=60
CONF_THRESHOLD=80

# Duplicate Detection
DUP_PHASH_THRESHOLD=10
TEXT_DISTANCE_THRESHOLD=0.8

# Pattern Matching
PATTERN_REGEX=^[A-Z0-9]{9}$
```

## Step 3: Install Vision Model (Ollama)

### Install Ollama
```bash
# Download and install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Verify installation
ollama --version
```

### Configure Ollama Service
```bash
# Create systemd service
sudo tee /etc/systemd/system/ollama.service > /dev/null <<EOF
[Unit]
Description=Ollama Server
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="OLLAMA_HOST=127.0.0.1:11434"

[Install]
WantedBy=default.target
EOF

# Create ollama user
sudo useradd -r -s /bin/false -m -d /usr/share/ollama ollama

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama

# Check status
sudo systemctl status ollama
```

### Download Vision Model
```bash
# Pull the LLaVA model (may take several minutes)
ollama pull llava

# Verify model is available
ollama list

# Test model endpoint
curl http://localhost:11434/api/tags
```

## Step 4: Install and Configure NGINX

### Install NGINX
```bash
sudo apt install nginx -y

# Start and enable NGINX
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Configure NGINX for Smart Passport OCR
```bash
# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Create configuration file
sudo tee /etc/nginx/sites-available/smart-passport-ocr > /dev/null <<'EOF'
server {
    listen 80;
    server_name smart-ocr.local;  # Change to your domain/IP
    
    # Allow large file uploads
    client_max_body_size 0;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    proxy_connect_timeout 600s;
    
    # Serve static frontend files
    root /var/www/smart-passport-ocr/dist/client;
    index index.html;
    
    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_buffering off;
    }
    
    # WebSocket for real-time updates
    location /ws/ {
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Logs
    access_log /var/log/nginx/smart-ocr.access.log;
    error_log /var/log/nginx/smart-ocr.error.log;
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/smart-passport-ocr /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload NGINX
sudo systemctl reload nginx
```

## Step 5: Create System Service

### Create Smart Passport OCR Service
```bash
sudo tee /etc/systemd/system/smart-passport-ocr.service > /dev/null <<EOF
[Unit]
Description=Smart Passport OCR
After=network.target ollama.service
Requires=ollama.service

[Service]
Type=simple
User=smartocr
Group=smartocr
WorkingDirectory=/var/www/smart-passport-ocr
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable smart-passport-ocr
```

## Step 6: Configure Firewall

### Setup UFW Firewall
```bash
# Enable UFW
sudo ufw enable

# Allow SSH (important!)
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

## Step 7: Start Services

### Start All Services
```bash
# Start Ollama (if not already running)
sudo systemctl start ollama

# Start Smart Passport OCR
sudo systemctl start smart-passport-ocr

# Check all services are running
sudo systemctl status ollama
sudo systemctl status smart-passport-ocr
sudo systemctl status nginx
```

### Verify Installation
```bash
# Check if application is responding
curl http://localhost:8000/api/health

# Check if frontend is served
curl http://localhost/

# View logs
sudo journalctl -u smart-passport-ocr -f
```

## Step 8: Access the Application

1. Open your web browser
2. Navigate to `http://your-server-ip/` or `http://your-domain/`
3. You should see the Smart Passport OCR interface

## Step 9: Testing the Setup

### Test File Upload
1. Create a test job
2. Upload a small ZIP file with a few images
3. Start processing
4. Monitor progress in real-time

### Test OCR Processing
```bash
# Check Ollama model is responding
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llava",
    "prompt": "What do you see in this image?",
    "stream": false
  }'
```

## Monitoring and Maintenance

### View Application Logs
```bash
# Real-time logs
sudo journalctl -u smart-passport-ocr -f

# View last 100 lines
sudo journalctl -u smart-passport-ocr -n 100

# View logs for specific date
sudo journalctl -u smart-passport-ocr --since "2024-01-01" --until "2024-01-02"
```

### Monitor System Resources
```bash
# Install monitoring tools
sudo apt install htop iotop

# Monitor CPU and memory
htop

# Monitor disk I/O
sudo iotop

# Check disk usage
df -h
du -sh /var/www/smart-passport-ocr/storage/*
```

### Regular Maintenance Tasks
```bash
# Create backup script
sudo tee /usr/local/bin/backup-smart-ocr.sh > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/backup/smart-ocr"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp /var/www/smart-passport-ocr/data/passport_ocr.db $BACKUP_DIR/db_$DATE.db

# Backup configuration
cp /var/www/smart-passport-ocr/.env $BACKUP_DIR/env_$DATE

# Clean old backups (keep 30 days)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
EOF

sudo chmod +x /usr/local/bin/backup-smart-ocr.sh

# Setup daily backup cron
echo "0 2 * * * /usr/local/bin/backup-smart-ocr.sh" | sudo crontab -
```

## Troubleshooting

### Common Issues

1. **Service won't start**
   ```bash
   sudo journalctl -u smart-passport-ocr --no-pager -l
   ```

2. **NGINX 502 errors**
   ```bash
   sudo nginx -t
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Ollama not responding**
   ```bash
   sudo systemctl restart ollama
   curl http://localhost:11434/api/tags
   ```

4. **Permission issues**
   ```bash
   sudo chown -R smartocr:smartocr /var/www/smart-passport-ocr
   sudo chmod -R 755 /var/www/smart-passport-ocr
   ```

5. **Database errors**
   ```bash
   # Check database file
   ls -la /var/www/smart-passport-ocr/data/
   
   # Test database connection
   sqlite3 /var/www/smart-passport-ocr/data/passport_ocr.db ".tables"
   ```

### Performance Optimization

For high-volume processing:

```bash
# Increase worker counts
# Edit /var/www/smart-passport-ocr/.env
PREPROC_WORKERS=4
OCR_WORKERS=4
RAM_TARGET_PCT=80

# Optimize NGINX
sudo nano /etc/nginx/nginx.conf
# Add in http block:
# worker_processes auto;
# worker_connections 1024;

# Restart services
sudo systemctl restart smart-passport-ocr
sudo systemctl restart nginx
```

## SSL/HTTPS Setup (Optional)

### Using Let's Encrypt
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

Your Smart Passport OCR application is now deployed and ready for production use!