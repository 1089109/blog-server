import { Request, Response, NextFunction } from 'express';
import { getUserPermissions } from '../utils/business';
import { resTemplate } from '../utils/function';
import { sendAuthError } from '../utils/token';
import { codes } from '../config';

/** 规范化 IP：去掉 IPv6 映射前缀等 */
export const normalizeClientIp = (raw?: string | null): string => {
  if (!raw) return '';
  let ip = String(raw).trim();
  if (!ip) return '';

  // X-Forwarded-For 可能带端口（少见）或引号
  ip = ip.replace(/^"|"$/g, '');
  if (ip.startsWith('[') && ip.includes(']')) {
    ip = ip.slice(1, ip.indexOf(']'));
  }

  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip;
};

const isLoopback = (ip: string) =>
  !ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

/** 解析客户端真实 IP */
export const clientIpMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const reqExt = req as Request & { clientIP?: string };

  if (reqExt.clientIP && !isLoopback(normalizeClientIp(reqExt.clientIP))) {
    next();
    return;
  }

  let ipAddress = '';

  const xForwardedFor = req.headers['x-forwarded-for'];
  if (Array.isArray(xForwardedFor)) {
    ipAddress = normalizeClientIp(xForwardedFor[0]);
  } else if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
    ipAddress = normalizeClientIp(xForwardedFor.split(',')[0]);
  }

  if (isLoopback(ipAddress)) {
    ipAddress = normalizeClientIp(req.headers['x-real-ip'] as string | undefined);
  }
  if (isLoopback(ipAddress)) {
    ipAddress = normalizeClientIp(req.socket.remoteAddress);
  }
  if (isLoopback(ipAddress) && req.ip) {
    ipAddress = normalizeClientIp(req.ip);
  }

  reqExt.clientIP = ipAddress || '127.0.0.1';
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
