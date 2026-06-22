import { Request, Response, NextFunction } from 'express';
import { getUserPermissions } from '../utils/business';
import { resTemplate } from '../utils/function';
import { sendAuthError } from '../utils/token';
import { codes } from '../config';

/** 解析客户端真实 IP */
export const clientIpMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const defaultIP = '::ffff:127.0.0.1';
  const reqExt = req as Request & { clientIP?: string };

  if (reqExt.clientIP && reqExt.clientIP !== defaultIP) {
    next();
    return;
  }

  let ipAddress: string | undefined;
  const xForwardedFor = req.headers['x-forwarded-for'];

  if (Array.isArray(xForwardedFor)) {
    ipAddress = xForwardedFor[0]?.trim();
  } else if (typeof xForwardedFor === 'string') {
    ipAddress = xForwardedFor.split(',')[0].trim();
  }

  if (!ipAddress || ipAddress === defaultIP) {
    ipAddress = req.headers['x-real-ip'] as string | undefined;
  }
  if (!ipAddress || ipAddress === defaultIP) {
    ipAddress = req.socket.remoteAddress;
  }

  reqExt.clientIP = ipAddress;
  next();
};

/** 管理员权限中间件 */
export const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  getUserPermissions(req)
    .then(() => next())
    .catch((error) => {
      const code = typeof error?.code === 'number' ? error.code : codes.error;
      if (code === codes.notLogin) {
        sendAuthError(res, error);
        return;
      }
      resTemplate(code, error?.message || '权限不足', res);
    });
};
