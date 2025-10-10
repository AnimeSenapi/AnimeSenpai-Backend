/**
 * PM2 Ecosystem Configuration for Anime Import Script
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 logs anime-import
 *   pm2 stop anime-import
 */

module.exports = {
  apps: [{
    name: 'anime-import',
    script: './scripts/standalone-import.js',
    interpreter: 'bun',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/import-error.log',
    out_file: './logs/import-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
}

