import type { Server } from 'http';
import { createApp } from './app';
import { connectDatabase, sequelize } from './models';
import { env } from './config';

let server: Server | null = null;
let shuttingDown = false;

async function closeResources() {
  await new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => resolve());
  });
  await sequelize.close().catch(() => {});
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await closeResources();
  process.exit(exitCode);
}

async function main() {
  await connectDatabase();

  const app = createApp();
  server = app.listen(env.port, () => {
    console.log(`Blog Server v2 启动成功 → http://localhost:${env.port}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`端口 ${env.port} 已被占用，请先结束旧进程：lsof -ti :${env.port} | xargs kill`);
      process.exit(1);
    }
    console.error('服务启动失败:', err);
    process.exit(1);
  });

  process.once('SIGINT', () => shutdown(0));
  process.once('SIGTERM', () => shutdown(0));
  // nodemon 默认重启信号：先释放端口，再通知 nodemon 继续
  process.once('SIGUSR2', async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await closeResources();
    process.kill(process.pid, 'SIGUSR2');
  });
}

main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
