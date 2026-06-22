export { codes, env as config } from '../config';

export const tokenkey = process.env.JWT_SECRET || 'blogServer';

export const uploadFilePrefix =
  process.env.NODE_ENV === 'development' ? './files' : '../files';

export const uploadPath = {
  image: `${uploadFilePrefix}/images/`,
  video: `${uploadFilePrefix}/videos/`,
  face: `${uploadFilePrefix}/faces/`,
  temp: `${uploadFilePrefix}/temp_file/`,
  banner: `${uploadFilePrefix}/banners/`,
};

export const ossConfig = {
  region: process.env.OSS_REGION || '',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  bucket: process.env.OSS_BUCKET || '',
  cdnUrl: process.env.OSS_CDN_URL || '',
};
