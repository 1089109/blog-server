import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config';
import { clientIpMiddleware, adminAuthMiddleware } from './middleware';
import configRouter from './routes/config';
import userRouter from './routes/users';
import blogrollRouter from './routes/blogroll';
import articleRouter from './routes/article';
import codeRouter from './routes/code';
import courseRouter from './routes/course/course';
import chapterRouter from './routes/course/chapter';
import logRouter from './routes/log';
import fileRouter from './routes/file';
import ossRouter from './routes/oss';
import bannerRouter from './routes/banners';
import commonRouter from './routes/common';
import questionBandRouter from './routes/questionBand';
import classRouter from './routes/classify';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Set-Cookie'],
      credentials: true,
      maxAge: 3600,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(clientIpMiddleware);

  app.use('/api/config', configRouter);
  app.use('/api/user', userRouter);
  app.use('/api/blogroll', blogrollRouter);
  app.use('/api/code', codeRouter);
  app.use('/api/class', classRouter);
  app.use('/api/article', articleRouter);
  app.use('/api/course', courseRouter);
  app.use('/api/chapter', chapterRouter);
  app.use('/api/log', logRouter);
  app.use('/api/banner', bannerRouter);
  app.use('/api/file', adminAuthMiddleware, fileRouter);
  app.use('/api/oss', adminAuthMiddleware, ossRouter);
  app.use('/api/common', commonRouter);
  app.use('/api/questionBand', questionBandRouter);

  app.get('/', (_req, res) => {
    res.send('Blog Server v2 (Express + Sequelize)');
  });

  return app;
}

/** webInfo.json 绝对路径（开发/生产均可用） */
export const webInfoPath = path.join(__dirname, '../config/webInfo.json');
