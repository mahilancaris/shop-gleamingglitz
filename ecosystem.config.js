/**
 * AETHER VAULT DISCORD BOT - PM2 CONFIGURATION FOR VPS
 * Usage on Linux VPS:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'aether-discord-bot',
      script: 'index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '250M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
