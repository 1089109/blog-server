module.exports = {
  apps: [
    {
      name: 'blog-api',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 8010,
      },
      // PM2 5.3+：显式注入生产 env 文件（与代码内 dotenv 双保险）
      env_file: '.env.production',
    },
  ],
};
