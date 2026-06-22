import { env, isDev } from '../config';
import { getOssPublicUrl, isOssEnabled } from './oss';

/** API 返回给前端的静态资源完整 URL */
export const resolvePublicAssetUrl = (path?: string | null): string => {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (isOssEnabled()) return getOssPublicUrl(normalized);
  if (isDev) return `http://localhost:${env.port}${normalized}`;
  return normalized;
};
