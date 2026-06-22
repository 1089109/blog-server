import { Request, Response } from 'express';
import { codes } from '../config';
import db from './db';
import { getClientIp } from './function';
import { apiCheckToken, normalizeAuthError } from './token';
import { UserInfo } from '../types/user';

export const getUserPermissions = (
  req: Request,
  notPermissions = true
): Promise<{ code: number; message: string; userInfo?: UserInfo }> => {
  return new Promise((resolve, reject) => {
    apiCheckToken(req)
      .then((data) => {
        const { data: tokenUserInfo } = data;
        db.query('SELECT * FROM users WHERE id=?', tokenUserInfo?.userId ?? 0, (err, result) => {
          const rows = result as UserInfo[];
          const userInfo = rows?.[0];

          if (err) {
            reject({ code: codes.dbError, message: JSON.stringify(err) });
            return;
          }
          if (!userInfo) {
            reject({ code: codes.error, message: '用户不存在' });
            return;
          }
          if (userInfo.roleCode >= 10 || !notPermissions) {
            resolve({ code: codes.success, message: '该用户权限可以操作', userInfo });
            return;
          }
          reject({ code: codes.permissions, message: codes.permissionsText });
        });
      })
      .catch((error) => reject(normalizeAuthError(error)));
  });
};

interface LogParams {
  content?: string | null;
  title: string;
  apiName: string;
  code?: number;
}

export const setLog = (req: Request, params: LogParams) => {
  const { content = null, title = null, code = 200, apiName } = params;
  const method = req.method;
  const ip = (req as Request & { clientIP?: string }).clientIP || getClientIp(req);

  const main = (uid: string | null, userName: string | null) => {
    db.query(
      `INSERT INTO system_log 
        (title, request_method, request_path, ip, request_params, create_time, uid, userName, content, api_name, code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        method,
        req.originalUrl,
        ip,
        method === 'GET' ? JSON.stringify(req.params) : JSON.stringify(req.body),
        new Date(),
        uid,
        userName,
        content,
        apiName,
        code,
      ]
    );
  };

  getUserPermissions(req)
    .then((data) => main(data.userInfo?.uid ?? null, data.userInfo?.userName ?? null))
    .catch(() => main(null, null));
};

export const getRoleName = (value: number) => {
  switch (value) {
    case 10:
      return '管理员';
    case 100:
      return '超级管理员';
    default:
      return '普通会员';
  }
};
