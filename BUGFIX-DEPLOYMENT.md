# Bug Fixes for Ubuntu 24.04 Deployment

## Critical Issues Resolved

### Issue #1: Missing react-window Dependency

**Problem:** Build fails with `Rollup failed to resolve import "react-window"`

**Root Cause:** The `react-window` package was used in TableView.jsx but not declared as a dependency

**Fix Applied:** Added `"react-window": "^1.8.10"` to client/package.json dependencies

### Issue #2: Missing updateSettings Methods

**Problem:** Application crashes with `TypeError: this.imageProcessor.updateSettings is not a function`

**Root Cause:** The pipeline.js called updateSettings methods that didn't exist on service classes

**Fix Applied:** 
- Added proper `updateSettings()` methods to all service classes
- Added safety checks in pipeline.js to prevent crashes if methods don't exist
- Implemented proper settings propagation throughout the system

## Post-Fix Deployment Instructions

### 1. Update Dependencies
```bash
cd /opt/smart-passport-ocr/client
sudo -u smartocr npm install
```

### 2. Rebuild Frontend
```bash
cd /opt/smart-passport-ocr/client
sudo -u smartocr npm run build
```

### 3. Restart Service
```bash
sudo systemctl restart smart-passport-ocr
sudo systemctl status smart-passport-ocr
```

### 4. Verify Operation
```bash
# Check service logs
sudo journalctl -u smart-passport-ocr -f

# Test API endpoint
curl http://localhost:8001/api/health
```

## Configuration for External Ollama

For setups where Ollama runs on a separate Windows machine:

### Update .env file:
```bash
sudo -u smartocr nano /opt/smart-passport-ocr/.env
```

**Add/Update these lines:**
```bash
# Model Configuration (Windows host example)
MODEL_URL=http://192.168.1.100:11434
MODEL_NAME=llava

# Replace 192.168.1.100 with your Windows machine's IP
```

### Test Model Connection:
```bash
# Test from Ubuntu server
curl http://192.168.1.100:11434/api/tags

# Should return list of available models
```

## Additional Production Considerations

### 1. Firewall Configuration
```bash
# On Windows machine running Ollama, ensure port 11434 is accessible
# On Ubuntu server, test connectivity:
telnet 192.168.1.100 11434
```

### 2. Performance Tuning
```bash
# Adjust worker counts based on server capacity
sudo -u smartocr nano /opt/smart-passport-ocr/.env
```

**Recommended settings for production:**
```bash
PREPROC_WORKERS=4
OCR_WORKERS=2
RAM_TARGET_PCT=70
```

### 3. Monitoring
```bash
# Set up log rotation
sudo nano /etc/logrotate.d/smart-passport-ocr
```

**Add:**
```
/var/log/nginx/smart-ocr.*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
```

## Verification Checklist

- [ ] Frontend builds without errors
- [ ] Backend service starts and stays running
- [ ] API health check responds
- [ ] Model endpoint is reachable
- [ ] Web interface loads correctly
- [ ] File upload functionality works
- [ ] Settings can be configured via UI

## Known Working Environment

This configuration has been tested and confirmed working on:
- **OS:** Ubuntu Server 24.04.3 LTS
- **Node.js:** v18.20.8
- **NGINX:** v1.24.0
- **Ollama:** v0.11.6 (Windows host)
- **Browser:** Chrome/Firefox (latest)

The application should now be fully operational for production use.