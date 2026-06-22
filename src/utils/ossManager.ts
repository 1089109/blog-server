import fs from 'fs';
import path from 'path';
import { uploadFilePrefix } from './config';
import { isOssEnabled, listObjectsDetailed } from './oss';

export interface AssetItem {
  path: string;
  name: string;
  category: string;
  categoryLabel: string;
  size: number;
  lastModified: string;
  mimeType?: string;
}

export const ASSET_CATEGORIES: Record<string, string> = {
  images: '内容图片',
  banners: '广告图片',
  system: '系统图片',
  faces: '用户头像',
  temp_file: '临时文件',
  videos: '视频',
};

const IMAGE_EXT = ['jpg', 'jpeg', 'gif', 'png', 'webp', 'svg', 'ico'];
const VIDEO_EXT = ['mp4', 'ogg', 'webm', 'mov'];
const ALL_EXT = [...IMAGE_EXT, ...VIDEO_EXT];

const getCategory = (filePath: string): { category: string; categoryLabel: string } => {
  const parts = filePath.replace(/^\//, '').split('/');
  const category = parts[0] || 'other';
  return {
    category,
    categoryLabel: ASSET_CATEGORIES[category] || category,
  };
};

const walkLocalDir = (dirPath: string, basePrefix: string, result: AssetItem[]): void => {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { encoding: 'utf-8' });
  entries.forEach((entry) => {
    if (entry === '.DS_Store') return;
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkLocalDir(fullPath, basePrefix, result);
      return;
    }
    const ext = entry.slice(entry.lastIndexOf('.') + 1).toLowerCase();
    if (!ALL_EXT.includes(ext)) return;

    const relative = fullPath.replace(uploadFilePrefix, '').replace(/\\/g, '/');
    const normalized = relative.startsWith('/') ? relative : `/${relative}`;
    const { category, categoryLabel } = getCategory(normalized);
    result.push({
      path: normalized,
      name: entry,
      category,
      categoryLabel,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
    });
  });
};

const listLocalAssets = (): AssetItem[] => {
  const result: AssetItem[] = [];
  walkLocalDir(uploadFilePrefix, uploadFilePrefix, result);
  return result;
};

const listOssAssets = async (): Promise<AssetItem[]> => {
  const prefixes = Object.keys(ASSET_CATEGORIES);
  const result: AssetItem[] = [];

  for (const prefix of prefixes) {
    const objects = await listObjectsDetailed(`${prefix}/`);
    objects.forEach((obj) => {
      const { category, categoryLabel } = getCategory(obj.path);
      result.push({
        path: obj.path,
        name: obj.path.slice(obj.path.lastIndexOf('/') + 1),
        category,
        categoryLabel,
        size: obj.size,
        lastModified: obj.lastModified,
      });
    });
  }

  return result;
};

export interface AssetPageParams {
  current?: number;
  pageSize?: number;
  category?: string;
  keyword?: string;
  sourceType?: 'image' | 'video' | 'all';
}

export interface AssetPageResult {
  dataSource: AssetItem[];
  total: number;
  ossEnabled: boolean;
}

export const pageAssets = async (params: AssetPageParams): Promise<AssetPageResult> => {
  const current = Math.max(1, Number(params.current) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const keyword = (params.keyword || '').trim().toLowerCase();
  const category = params.category || '';
  const sourceType = params.sourceType || 'all';

  let all = isOssEnabled() ? await listOssAssets() : listLocalAssets();

  if (sourceType === 'image') {
    all = all.filter((item) => item.category !== 'videos');
  } else if (sourceType === 'video') {
    all = all.filter((item) => item.category === 'videos');
  }

  if (category) {
    all = all.filter((item) => item.category === category);
  }

  if (keyword) {
    all = all.filter(
      (item) =>
        item.path.toLowerCase().includes(keyword) ||
        item.name.toLowerCase().includes(keyword)
    );
  }

  all.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

  const total = all.length;
  const start = (current - 1) * pageSize;
  const dataSource = all.slice(start, start + pageSize);

  return {
    dataSource,
    total,
    ossEnabled: isOssEnabled(),
  };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
