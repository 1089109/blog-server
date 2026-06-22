import OSS from 'ali-oss';
import { ossConfig } from './config';

type OssClient = OSS;

let client: OssClient | null = null;

const getClient = (): OssClient => {
  if (!client) {
    client = new OSS({
      region: ossConfig.region,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
      bucket: ossConfig.bucket,
    });
  }
  return client;
};

export const isOssEnabled = (): boolean => {
  return !!(
    ossConfig.region &&
    ossConfig.accessKeyId &&
    ossConfig.accessKeySecret &&
    ossConfig.bucket
  );
};

/** 相对路径转 OSS object key，如 /images/2024-01-01/a.jpg => images/2024-01-01/a.jpg */
export const toObjectKey = (relativePath: string): string => {
  return relativePath.replace(/^\//, '');
};

export const uploadBuffer = async (
  buffer: Buffer,
  objectKey: string,
  mimeType?: string
): Promise<void> => {
  await getClient().put(objectKey, buffer, {
    mime: mimeType,
  });
};

export const deleteObject = async (objectKey: string): Promise<void> => {
  await getClient().delete(objectKey);
};

export const copyObject = async (sourceKey: string, destKey: string): Promise<void> => {
  await getClient().copy(destKey, sourceKey);
};

export const listObjects = async (prefix: string): Promise<string[]> => {
  const items = await listObjectsDetailed(prefix);
  return items.map((item) => item.path);
};

export interface OssObjectMeta {
  path: string;
  size: number;
  lastModified: string;
}

/** 列出 OSS 文件及元信息 */
export const listObjectsDetailed = async (prefix: string): Promise<OssObjectMeta[]> => {
  const oss = getClient();
  const result: OssObjectMeta[] = [];
  let marker: string | undefined;

  do {
    const response = await oss.list({
      prefix: prefix.replace(/^\//, ''),
      marker,
      'max-keys': 1000,
    }, {});

    (response.objects || []).forEach((obj: { name?: string; size?: number; lastModified?: string }) => {
      if (obj.name && !obj.name.endsWith('/')) {
        result.push({
          path: `/${obj.name}`,
          size: obj.size ?? 0,
          lastModified: obj.lastModified ?? '',
        });
      }
    });
    marker = response.isTruncated ? response.nextMarker : undefined;
  } while (marker);

  return result;
};

export const getOssPublicUrl = (relativePath: string): string => {
  const key = toObjectKey(relativePath);
  if (ossConfig.cdnUrl) {
    return `${ossConfig.cdnUrl.replace(/\/$/, '')}/${key}`;
  }
  return `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/${key}`;
};

/** OSS/CDN 根地址，用于后台图片库拼接相对路径 */
export const getOssCdnBase = (): string => {
  if (ossConfig.cdnUrl) {
    return `${ossConfig.cdnUrl.replace(/\/$/, '')}/`;
  }
  return `https://${ossConfig.bucket}.${ossConfig.region}.aliyuncs.com/`;
};

export interface OssFileMeta {
  path: string;
  size: number;
  lastModified: string;
}

/** 列出 OSS 文件及元信息 */
export const listObjectsWithMeta = async (prefix: string): Promise<OssFileMeta[]> => {
  const oss = getClient();
  const result: OssFileMeta[] = [];
  let marker: string | undefined;
  const normalizedPrefix = prefix.replace(/^\//, '');

  do {
    const response = await oss.list({
      prefix: normalizedPrefix,
      marker,
      'max-keys': 1000,
    }, {});

    (response.objects || []).forEach((obj: { name?: string; size?: number; lastModified?: string }) => {
      if (obj.name && !obj.name.endsWith('/')) {
        result.push({
          path: `/${obj.name}`,
          size: obj.size ?? 0,
          lastModified: obj.lastModified ?? '',
        });
      }
    });
    marker = response.isTruncated ? response.nextMarker : undefined;
  } while (marker);

  return result;
};
