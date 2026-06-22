import dotenv from 'dotenv';
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 8010,
  isDev: process.env.NODE_ENV !== 'production',
  jwtSecret: process.env.JWT_SECRET || 'blogServer',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:8011',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'blog',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
  oss: {
    region: process.env.OSS_REGION || '',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || '',
    cdnUrl: process.env.OSS_CDN_URL || '',
  },
  sms: {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    signName: process.env.ALIYUN_SMS_SIGN_NAME || '',
    templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
  },
  uploadFilePrefix: process.env.NODE_ENV === 'development' ? './files' : '../files',
  /** 启动时自动创建缺失的表（默认开启，设 DB_AUTO_SYNC=false 关闭） */
  dbAutoSync: process.env.DB_AUTO_SYNC !== 'false',
};

export const isDev = env.isDev;
export const hostname = process.env.WEB_HOST || 'http://www.huangcy.com';

export const codes = {
  error: 999,
  errorText: '系统异常',
  dbError: 998,
  dbErrorText: '数据库错误',
  success: 200,
  updateError: 997,
  updateErrorText: '数据更新失败',
  notViewData: 996,
  notViewDataText: '数据不存在',
  notLogin: 401,
  notLoignText: '登录失效, 请重新登录',
  permissions: 403,
  permissionsText: '用户权限不足',
};
