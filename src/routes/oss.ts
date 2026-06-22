import express from 'express';
import multer from 'multer';
import { resTemplate, checkField, codes, dbError } from '../utils';
import { pageAssets, ASSET_CATEGORIES } from '../utils/ossManager';
import { findAssetReferences } from '../utils/ossRefs';
import {
  generateFileName,
  removeUploadedFile,
  resolveUploadType,
  saveUploadedFile,
} from '../utils/storage';
import { isOssEnabled } from '../utils/oss';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

const getFirstFile = (req: express.Request) => {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    return null;
  }
  return req.files[0];
};

/** 分页列表 */
router.post('/page', async (req, res) => {
  try {
    const result = await pageAssets(req.body || {});
    resTemplate(codes.success, '查询成功', res, result);
  } catch (err) {
    console.error('OSS 列表查询失败', err);
    dbError(err, res);
  }
});

/** 分类选项 */
router.get('/categories', (_req, res) => {
  const categories = Object.entries(ASSET_CATEGORIES).map(([value, label]) => ({
    value,
    label,
  }));
  resTemplate(codes.success, 'ok', res, {
    categories,
    ossEnabled: isOssEnabled(),
  });
});

/** 查看引用 */
router.post('/references', async (req, res) => {
  const { filePath } = req.body || {};
  if (checkField(filePath, res, '文件路径')) return;

  try {
    const refs = await findAssetReferences(filePath);
    resTemplate(codes.success, '查询成功', res, {
      referenced: refs.length > 0,
      total: refs.length,
      refs,
    });
  } catch (err) {
    console.error('查询引用失败', err);
    dbError(err, res);
  }
});

/** 删除（有引用时需 force=true） */
router.post('/delete', async (req, res) => {
  const { filePath, force = false } = req.body || {};
  if (checkField(filePath, res, '文件路径')) return;

  try {
    const refs = await findAssetReferences(filePath);
    if (refs.length > 0 && !force) {
      resTemplate(codes.error, '该文件仍被引用，无法删除', res, {
        referenced: true,
        total: refs.length,
        refs,
      });
      return;
    }

    await removeUploadedFile(filePath);
    resTemplate(codes.success, force && refs.length > 0 ? '已强制删除' : '删除成功', res);
  } catch (err) {
    console.error('删除 OSS 文件失败', err);
    resTemplate(codes.error, '删除失败', res);
  }
});

/** 上传 */
router.post('/upload', upload.any(), async (req, res) => {
  const firstFile = getFirstFile(req);
  if (checkField(firstFile as any, res, '文件')) return;

  let { pathCode = 10 } = req.body || {};
  if (Number(pathCode) === 0 && req.query?.pathCode) {
    pathCode = req.query.pathCode;
  }

  const fileName = firstFile!.originalname ?? '';
  const lastIndex = fileName.lastIndexOf('.');
  const suffix = fileName.slice(lastIndex);
  const type = resolveUploadType(Number(pathCode), suffix);
  const savedName = generateFileName(firstFile!.originalname);

  try {
    const { url } = await saveUploadedFile(
      firstFile!.buffer,
      type,
      savedName,
      firstFile!.mimetype
    );

    resTemplate(codes.success, '上传成功', res, {
      fileName: savedName,
      fileSize: firstFile!.size,
      fileType: firstFile!.mimetype,
      url,
    });
  } catch (err) {
    console.error('OSS 上传失败', err);
    resTemplate(codes.error, '上传失败', res);
  }
});

export default router;
