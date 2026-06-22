import fs from 'fs';
import path from 'path';
import { MyFileType } from '../types/global';
import { getFilePath, setFilePath } from './filePaths';
import { uploadFilePrefix } from './config';
import {
  copyObject,
  deleteObject,
  isOssEnabled,
  listObjects,
  toObjectKey,
  uploadBuffer,
} from './oss';
import moment from 'moment';

const PERMANENT_UPLOAD_PREFIXES = [
  '/images/',
  '/banners/',
  '/system/',
  '/faces/',
  '/videos/',
];

export const generateFileName = (originalName: string): string => {
  const lastIndex = originalName.lastIndexOf('.');
  const suffix = originalName.slice(lastIndex);
  const baseName = originalName.slice(0, lastIndex);
  return `${baseName}__${Date.now()}${suffix}`;
};

export const resolveUploadType = (pathCode: number, suffix: string): MyFileType => {
  if (['.mp4'].includes(suffix)) {
    return 'video';
  }

  switch (Number(pathCode)) {
    case 10:
      return 'image';
    case 20:
      return 'banner';
    case 30:
      return 'system';
    case 40:
      return 'face';
    default:
      return 'temp';
  }
};

const normalizeRelativePath = (filePath: string): string =>
  filePath.startsWith('/') ? filePath : `/${filePath}`;

export const isPermanentUploadPath = (filePath: string): boolean => {
  const normalized = normalizeRelativePath(filePath);
  return PERMANENT_UPLOAD_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

export const saveUploadedFile = async (
  buffer: Buffer,
  type: MyFileType,
  fileName: string,
  mimeType?: string
): Promise<{ fileName: string; url: string }> => {
  const relativePath = getFilePath(type, fileName);

  if (isOssEnabled()) {
    await uploadBuffer(buffer, toObjectKey(relativePath), mimeType);
  } else {
    const dirPath = setFilePath(type);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(path.join(dirPath, fileName), buffer);
  }

  return { fileName, url: relativePath };
};

export const removeUploadedFile = async (filePath: string): Promise<void> => {
  const relativePath = filePath.startsWith('/') ? filePath : `/${filePath}`;

  if (isOssEnabled()) {
    await deleteObject(toObjectKey(relativePath));
    return;
  }

  const localPath = path.join(uploadFilePrefix, relativePath);
  if (fs.existsSync(localPath)) {
    fs.unlinkSync(localPath);
  }
};

export const moveUploadedFile = async (fileNameOrPath: string): Promise<string> => {
  const input = String(fileNameOrPath ?? '').trim();
  if (!input) return input;

  const normalized = normalizeRelativePath(input);

  // 已在正式目录（上传 pathCode=10 或 OSS 图片库选取）则无需再搬
  if (isPermanentUploadPath(normalized)) {
    return normalized;
  }

  let sourcePath: string;
  if (normalized.startsWith('/temp_file/')) {
    sourcePath = normalized;
  } else {
    const fileName = normalized.includes('/')
      ? normalized.slice(normalized.lastIndexOf('/') + 1)
      : normalized;
    sourcePath = `/temp_file/${moment().format('YYYY-MM-DD')}/${fileName}`;
  }

  const fileName = sourcePath.slice(sourcePath.lastIndexOf('/') + 1);
  const destPath = getFilePath('image', fileName);

  if (sourcePath === destPath) {
    return destPath;
  }

  if (isOssEnabled()) {
    await copyObject(toObjectKey(sourcePath), toObjectKey(destPath));
    try {
      await deleteObject(toObjectKey(sourcePath));
    } catch {
      // 临时文件可能不存在，忽略
    }
  } else {
    const saveDir = setFilePath('image');
    const sourceDir = setFilePath('temp');
    const sourceFile = normalized.startsWith('/temp_file/')
      ? path.join(uploadFilePrefix, sourcePath)
      : path.join(sourceDir, fileName);
    const destFile = path.join(saveDir, fileName);

    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }
    if (fs.existsSync(sourceFile)) {
      fs.renameSync(sourceFile, destFile);
    }
  }

  return destPath;
};

interface ImageTreeNode {
  name: string;
  type: 'dir';
  className?: string;
  images: Array<string | ImageTreeNode>;
}

const dirNames: Record<string, string> = {
  banners: '广告图片',
  faces: '用户头像',
  images: '内容图片',
  system: '系统图片',
  temp_file: '临时图片',
  videos: '视频列表',
};

const buildLocalImageTree = (
  dirPath: string,
  formats: string[],
  sourceType: string
): ImageTreeNode[] => {
  const isFile = (filepath: string) => fs.statSync(filepath).isFile();
  const isDir = (filepath: string) => fs.statSync(filepath).isDirectory();

  const walk = (currentPath: string, result: Array<string | ImageTreeNode>): void => {
    const files = fs.readdirSync(currentPath, { encoding: 'utf-8' });
    files.forEach((item) => {
      if (item === '.DS_Store') return;

      const fullPath = `${currentPath}/${item}`;
      if (isDir(fullPath)) {
        if (sourceType === 'image' && item === 'videos') return;

        const images: Array<string | ImageTreeNode> = [];
        const node: ImageTreeNode = {
          name: item,
          type: 'dir',
          images,
        };
        if (dirNames[item]) {
          node.className = dirNames[item];
        }
        result.push(node);
        walk(fullPath, images);
      } else if (isFile(fullPath)) {
        const suffix = fullPath.slice(fullPath.lastIndexOf('.') + 1).toLowerCase();
        if (formats.includes(suffix)) {
          result.push(fullPath.replace(uploadFilePrefix, ''));
        }
      }
    });
  };

  const result: ImageTreeNode[] = [];
  walk(dirPath, result);
  return result;
};

const buildOssImageTree = async (
  formats: string[],
  sourceType: string
): Promise<ImageTreeNode[]> => {
  const topDirs = sourceType === 'image'
    ? ['banners', 'faces', 'images', 'system', 'temp_file']
    : ['videos'];

  const result: ImageTreeNode[] = [];

  for (const dirName of topDirs) {
    const objects = await listObjects(`${dirName}/`);
    const filtered = objects.filter((objectPath) => {
      const suffix = objectPath.slice(objectPath.lastIndexOf('.') + 1).toLowerCase();
      return formats.includes(suffix);
    });

    if (filtered.length === 0) continue;

    const dateGroups = new Map<string, string[]>();
    const flatFiles: string[] = [];

    filtered.forEach((objectPath) => {
      const parts = objectPath.split('/').filter(Boolean);
      if (parts.length >= 3) {
        const dateDir = parts[1];
        const list = dateGroups.get(dateDir) || [];
        list.push(objectPath);
        dateGroups.set(dateDir, list);
      } else if (parts.length === 2) {
        flatFiles.push(objectPath);
      }
    });

    const images: Array<string | ImageTreeNode> = [];

    dateGroups.forEach((files, dateName) => {
      images.push({
        name: dateName,
        type: 'dir',
        images: files,
      });
    });

    if (flatFiles.length > 0) {
      images.push(...flatFiles);
    }

    result.push({
      name: dirName,
      type: 'dir',
      className: dirNames[dirName],
      images,
    });
  }

  return result;
};

export const getImageTree = async (
  formats: string[],
  sourceType: string
): Promise<ImageTreeNode[]> => {
  if (isOssEnabled()) {
    return buildOssImageTree(formats, sourceType);
  }
  return buildLocalImageTree(uploadFilePrefix, formats, sourceType);
};
