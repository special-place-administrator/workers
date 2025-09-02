module.exports = {
  apps: [
    {
      name: 'ocr-api',
      script: 'dist/api.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: { NODE_ENV: 'production' },
      max_memory_restart: '1G'
    },
    {
      name: 'ocr-workers',
      script: 'dist/workers.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: { NODE_ENV: 'production' },
      max_memory_restart: '2G'
    }
  ]
};
