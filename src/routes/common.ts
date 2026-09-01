import express from 'express'
const router = express.Router();
import { resTemplate, checkField, dbError, codes, setCondition, setSorter } from '../utils';
import db from '../utils/db';
import { moveFile, mysqlFieldTohump } from '../utils/function';
import { getUserPermissions } from '../utils/business';
import { ClassArticleDetail } from '../types/classify';
import { ChapterRule } from '../types/course';

/**
 * @api {post} /api/common/news
 * @apiName 最新的教程和最新的分类文章
 * @apiGroup Article
 * 
 * @apiParam {Number} current 当前页
 * @apiParam {Number} pageSize 分页大小
 */
router.post('/news', async(req, res) => {
  const { current = 1, pageSize = 20, sorter } = req.body || {};
  const resultMap: {
    articleTotal: number;
    courseTotal: number;
    classArticleList: ClassArticleDetail[];
    courseList: ChapterRule[];
    articleOtherList: {
      articleId: number;
      count: number;
      type: 'parise' | 'collect';
      businessCode: number;
    }[];
  } = {
    articleTotal: 0,
    classArticleList: [],
    courseTotal: 0,
    courseList: [],
    articleOtherList: [],
  }

  const beforePromise = new Promise((resolve, reject) => {
    const sql =  `SELECT article_id, count(type) count, type, business_code FROM article_other GROUP BY article_id,type,business_code`;
    db.query(sql, (err, data) => {
      if (err) {
        reject(err);
        dbError(err, res);
        return;
      }
      resultMap.articleOtherList = mysqlFieldTohump(data);
      resolve(true);
    })
  })
  
  // 查询分类文章总数量
  const promise1 = new Promise((resolve, reject) => {
    const sql = `SELECT COUNT(id) count FROM class_article`;
    db.query(sql, (err, data) => {
      if (err) {
        reject(err);
        dbError(err, res);
        return;
      }
      resultMap.articleTotal = data[0]?.count??0;
      resolve(true);
    })
  })

  // 查询最新分类文章
  const promise2 = new Promise((resolve, reject) => {
    const  sql = `
      SELECT
        ca.id,
        title,
        description,
        keywords,
        ca.create_time,
        thumbnail,
        browse_number,
        users.userName,
        cp.text classParentName,
				cc.text classChildName,
        cp.id classParentId,
        cc.id classChildId
      FROM
        class_article ca
      LEFT JOIN users ON ca.uid = users.uid
      LEFT JOIN class_parent cp ON ca.class_parent_id=cp.id
			LEFT JOIN class_child cc ON ca.class_child_id=cc.id
      WHERE ca.status=1
      ${setSorter(sorter)} LIMIT ${(current - 1) * pageSize}, ${pageSize}
    `;
    db.query(sql, (err, data) => {
      if (err) {
        reject(err);
        dbError(err, res);
        return;
      }
      resultMap.classArticleList = mysqlFieldTohump(data);
      resolve(true);
    })
  });

  // 教程数量（与列表一致：仅上线）
  const promise3 = new Promise((resolve, reject) => {
    const sql = `SELECT count(id) count FROM course WHERE status = 1`;
    db.query(sql, (err, data) => {
      if (err) {
        reject(err);
        dbError(err, res);
        return;
      }
      resultMap.courseTotal = data[0]?.count??0;
      resolve(true);
    })
  })

  // 教程列表：始终按排序号 + 创建时间；勿复用文章的 sorter，也不要依赖并行中尚未赋值的 courseTotal
  const promise4 = new Promise((resolve, reject) => {
    const sql = `
      SELECT
        course.id,
        course_name,
        course.status,
        course.create_time,
        course.update_time,
        course.sort,
        keyword,
        course.describe,
        thumbnail,
        price,
        discounts_price,
        class_id,
        cp.text classParentType
      FROM
        course
      LEFT JOIN class_parent cp ON course.class_id = cp.id
      WHERE course.status = 1
      ORDER BY course.sort DESC, course.create_time DESC
      LIMIT ${(current - 1) * pageSize}, ${pageSize}
    `;
    db.query(sql, (err, data) => {
      if (err) {
        reject(err);
        dbError(err, res);
        return;
      }
      resultMap.courseList = mysqlFieldTohump(data);
      resolve(true);
    })
  })

  
  Promise.all([beforePromise, promise1, promise2, promise3, promise4]).then(() => {
    resultMap.classArticleList.map( item => {
      item.parise = 0;
      item.collect = 0;
      // item.commentCount = 0; // 评论数量

      resultMap.articleOtherList.map((articleItem) => {
        if (articleItem.businessCode === 1 && item.id === articleItem.articleId) {
          // 收藏和点赞的数量
          // @ts-ignore 
          item[articleItem.type] = articleItem.count;
        }
      })
    })
    resTemplate(codes.success, '查询成功', res, resultMap);
  }).catch(err => {
    console.log('/api/common/news ->', err)
  })
})

export default router;
