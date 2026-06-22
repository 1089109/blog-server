/*
 * @Author: HuangChaoYi
 * @email: 1089109@qq.com
 * @Date: 2021-10-29 21:31:10
 * @LastEditTime: 2024-09-21 16:43:37
 * 
 * 文件系统
 */
import express from 'express';
const router = express.Router();
import  { resTemplate, checkField } from '../utils';
import {  codes } from '../utils/config';
import { dbError } from '../utils/function';
import multer from 'multer';
import db from '../utils/db';
import { getUserPermissions } from '../utils/business';
import {
  generateFileName,
  getImageTree,
  removeUploadedFile,
  resolveUploadType,
  saveUploadedFile,
} from '../utils/storage';

const upload = multer({ storage: multer.memoryStorage() });

const getFirstFile = (req: express.Request) => {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    return null;
  }
  return req.files[0];
};

/**
 * @api {post} /api/file/upload 文件上传
 * @apiName 文件上传
 * @apiGroup File
 *
 * @apiParam {String} pathCode 指定路径到哪里 10 images 20 banners 30 system
 *
 */
router.post('/upload', upload.any(), async (req, res) => {
  const firstFile = getFirstFile(req);
  if (checkField(firstFile as any, res, '文件')) return;

  let { pathCode = 0 } = req.query as any;
  if (Number(pathCode) === 0 && req.body?.pathCode) {
    pathCode = req.body.pathCode;
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

    resTemplate(codes.success, '文件上传成功', res, {
      fileName: savedName,
      fileSize: firstFile!.size,
      fileType: firstFile!.mimetype,
      url,
    });
  } catch (err) {
    console.error('文件上传失败', err);
    resTemplate(codes.error, '文件上传失败', res);
  }
});

router.post('/face', upload.any(), async (req, res) => {
  try {
    const data = await getUserPermissions(req);
    const { userInfo } = data;
    const firstFile = getFirstFile(req);

    if (!firstFile) {
      resTemplate(codes.error, '请上传文件', res);
      return;
    }

    const uid = userInfo?.uid ?? '';
    if (checkField(uid, res, '', '用户id不能为空')) return;
    if (checkField(firstFile as any, res, '文件')) return;

    const lastIndex = firstFile.originalname.lastIndexOf('.');
    const suffix = firstFile.originalname.slice(lastIndex);
    const savedName = `${userInfo?.userName}${suffix}`;

    const { url } = await saveUploadedFile(
      firstFile.buffer,
      'face',
      savedName,
      firstFile.mimetype
    );

    const update = `UPDATE users SET face=? WHERE uid=?`;
    db.query(update, [url, uid], (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.affectedRows) {
        resTemplate(codes.success, '文件上传成功', res, {
          fileName: savedName,
          fileSize: firstFile.size,
          fileType: firstFile.mimetype,
          url,
        });
        return;
      }
      resTemplate(codes.error, '更换修改', res);
    });
  } catch (err: any) {
    resTemplate(err.code, err.message, res);
  }
});

/**
 * @api {post} /api/file/upload/editor 文件上传
 * @apiName 文件上传,用于响应编辑器一致的格式
 * @apiGroup File
 *
 * @apiParam {String} pathCode 路径路径地方 0默认(存放在临时目录files/temp_file) 10(存放在files/images/天日期)
 *
 */
router.post('/upload/editor', upload.any(), async (req, res) => {
  const firstFile = getFirstFile(req);
  if (checkField(firstFile as any, res, '文件')) return;

  const { pathCode = 0 } = req.body;
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

    res.json({
      errno: 0,
      data: { url },
    });
  } catch (err) {
    console.error('编辑器文件上传失败', err);
    res.json({
      errno: 1,
      message: '文件上传失败',
    });
  }
});

/**
 * @api {post} /api/file/list 所有已上传的文件图片
 * @apiName 文件上传,用于响应编辑器一致的格式
 * @apiGroup File
 *
 *
 */
router.get('/list', (req, res) => {
  let result = {
    banners: [],
    faces: [],
    temps: [],
    videos: [],
    images: [],
  }
  res.send(result);
})

/**
 * @api {post} /api/file/image/utils 图片库
 * @apiName 图片库
 * @apiGroup File
 *
 * @apiParam {String} pathCode 
*/
router.post('/image/utils', async(req, res) => {
  const { sourceType = 'image' } = req.body;
  const formats = sourceType === 'image'
    ? ['jpg', 'jpeg', 'gif', 'png', 'webp']
    : ['mp4', 'ogg', 'webm'];

  try {
    const result = await getImageTree(formats, sourceType);
    resTemplate(200, 'ok', res, result);
  } catch (err) {
    console.error('获取图片库失败', err);
    resTemplate(codes.error, '获取图片库失败', res);
  }
});

/**
 * @api {post} /api/file/image/delete 删除图片
 * @apiName 图片库
 * @apiGroup File
 *
 * @apiParam {String} pathCode 
*/
router.post('/image/delete', async(req, res) => {
  const { filePath = '' } = req.body;

  try {
    await removeUploadedFile(filePath);
    resTemplate(200, '删除成功', res);
  } catch (err) {
    console.error('删除文件失败', err);
    resTemplate(999, '删除失败', res, JSON.stringify(err));
  }
});

export default router;
