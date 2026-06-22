import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../utils/db';
import { dbError, resTemplate, codes, isDev } from '../utils';
import { isOssEnabled, getOssCdnBase } from '../utils/oss';
import { env } from '../config';

const webInfoPath = path.join(__dirname, '../../config/webInfo.json');
const router = express.Router();

/**
 * @api {get} /api/config/base
 * @apiName 网站信息
 * @apiGroup Config
 * 
 */
router.get('/base', async (req, res) => {
  let resultMap: any = {};

  // 网站基本信息
  const locationInfo = new Promise((resolve, reject) => {
    fs.readFile(webInfoPath, function (err, data) {
      if (err) {
        reject(err);
        dbError(err, res);
        return;
      }

      resolve(true);
      const result = JSON.parse(data.toString());
      result.adminLink = isDev ? 'http://localhost:8000/' : 'http://admin.huangcy.com/';
      result.webLink = isDev ? 'http://localhost:8011' : 'http://www.huangcy.com';
      if (isOssEnabled()) {
        result.fileHost = getOssCdnBase();
      } else if (isDev) {
        result.fileHost = `http://localhost:${env.port}/`;
      }
      resultMap = { ...resultMap, ...result };
    });
  })


  // 浏览量：文章 + 教程章节（数值相加，避免 MySQL SUM 字符串拼接）
  const browsePromise = new Promise((resolve, reject) => {
    const select = `
      SELECT
        (SELECT COALESCE(SUM(browse_number), 0) FROM class_article) +
        (SELECT COALESCE(SUM(brower_number), 0) FROM course_chapter) AS browseCount
    `;
    db.query(select, (err, data) => {
      if (err) {
        dbError(err, res);
        reject(err);
        return;
      }
      resolve(true);
      const row = data[0] || {};
      resultMap = {
        ...resultMap,
        browseCount: Number(row.browseCount ?? 0),
      };
    });
  });

  // 教程章节浏览量已合并到 browsePromise，保留占位避免改动 Promise.all 结构
  const browsePromise1 = Promise.resolve(true);

  // 文章量
  const articlePromise = new Promise((resolve, reject) => {
    const select = `SELECT COUNT(id) articleCount FROM class_article WHERE status=1`;
    db.query(select, (err, data) => {
      if (err) {
        // dbError(err, res);
        reject(err);
        return;
      }
      resolve(true);
      resultMap = { ...resultMap, ...(data[0] || {}) };
    })
  })

  // 用户量
  const userPromise = new Promise((resolve, reject) => {
    const select = `SELECT COUNT(id) userCount FROM users`;
    db.query(select, (err, data) => {
      if (err) {
        // dbError(err, res);
        reject(err);
        return;
      }
      resolve(true);
      resultMap = { ...resultMap, ...(data[0] || {}) };
    })
  })

  // 评论量
  const commentPromise = new Promise((resolve, reject) => {
    const classSelect = `SELECT COUNT(id) commentCount FROM class_comments`;
    const courseSelect = `SELECT COUNT(id) commentCount FROM course_chapter_comments`;
    db.query(classSelect, (err, classData) => {
      if (err) {
        // dbError(err, res);
        reject(err);
        return;
      }
      const classCount = classData[0]?.commentCount ?? 0;

      db.query(courseSelect, (err, courseData) => {
        if (err) {
          // dbError(err, res);
          reject(err);
          return;
        }
        const courseCount = courseData[0]?.commentCount ?? 0;

        resolve(true);
        resultMap = { ...resultMap, commentCount: classCount + courseCount };
      })
    })
  })

  await Promise.all([locationInfo, browsePromise,browsePromise1, articlePromise, userPromise, commentPromise]).then(() => {
    resTemplate(codes.success, '查询成功', res, resultMap);
  }).catch(err => {
    resTemplate(codes.error, '查询失败', res, err);
  })
})



export default router;
