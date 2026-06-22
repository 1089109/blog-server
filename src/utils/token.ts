import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response } from 'express';
import { tokenkey } from './config';
import { codes } from '../config';
import { UserInfo } from '../types/user';
import { APICheckTokenResult } from '../types/token';

export const setToken = (userInfo: UserInfo, time: string | number = '12h'): Promise<string> => {
  const payload = { userName: userInfo.userName, userId: userInfo.id, uid: userInfo.uid };
  const options: SignOptions = { expiresIn: time as SignOptions['expiresIn'] };
  return Promise.resolve(jwt.sign(payload, tokenkey, options));
};

export const verToken = (token: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    try {
      const raw = (token.startsWith('Bearer ') ? token.slice(7) : token).trim();
      resolve(jwt.verify(raw, tokenkey));
    } catch (error) {
      reject(error);
    }
  });
};

export function normalizeAuthError(error: unknown): { code: number; message: string } {
  if (error && typeof error === 'object') {
    const err = error as { code?: number; message?: string; name?: string };
    if (typeof err.code === 'number' && err.message) {
      return { code: err.code, message: err.message };
    }
    if (err.message === 'jwt expired' || err.name === 'TokenExpiredError') {
      return { code: codes.notLogin, message: codes.notLoignText };
    }
    if (err.message === 'jwt malformed' || err.name === 'JsonWebTokenError') {
      return { code: codes.notLogin, message: '登录信息无效，请重新登录' };
    }
    if (err.message === 'jwt must be provided') {
      return { code: codes.notLogin, message: '请先登录' };
    }
    if (err.message) {
      return { code: codes.notLogin, message: err.message };
    }
  }
  return { code: codes.notLogin, message: codes.notLoignText };
}

export const apiCheckToken = (
  req: Request
): Promise<{ code: number; message: string; data?: APICheckTokenResult }> => {
  const token = req.headers['authorization'];
  if (token === undefined) {
    return Promise.reject({ code: codes.notLogin, message: '请先登录' });
  }

  return verToken(token as string)
    .then((data) => ({ code: codes.success, message: '验证成功', data: data as APICheckTokenResult }))
    .catch((error) => Promise.reject(normalizeAuthError(error)));
};

export const getTokenInfo = (req: Request) => {
  const token = req.headers['authorization'];
  if (!token) return Promise.resolve(null);
  return verToken(token as string);
};

/** 统一返回登录失效响应（HTTP 401 + 业务 code 401） */
export function sendAuthError(res: Response, error: unknown) {
  const { code, message } = normalizeAuthError(error);
  res.status(401).json({
    code,
    msg: message,
    data: {},
    success: false,
  });
}
