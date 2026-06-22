import express from 'express';
import { dbError, resTemplate } from '../utils';
import { getUserPermissions } from '../utils/business';
import db from '../utils/db';
import { codes } from '../utils';
import { mysqlFieldTohump } from '../utils/function';

const router = express.Router();

/**
 * @api {post} /api/log/list
 * @apiName 日志列表
 * @apiGroup Log
 * 
 * @apiParam {Number} current 
 * @apiParam {Number} pageSize
 */
router.post('/list', (req, res) => {
  getUserPermissions(req).then(data => {
    const { 
      current = 1, 
      pageSize = 20,
    } = req.body;
    const selectSql = `SELECT * FROM system_log ORDER BY create_time DESC LIMIT ${(current - 1) * pageSize}, ${pageSize}`;
    const totalSql = `SELECT COUNT(id) total FROM system_log`;
    let total = 0;

    db.query(totalSql, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      total = result[0].total;
    })

    db.query(selectSql, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      resTemplate(codes.success, '查询成功', res, {
        current,
        pageSize,
        total,
        dataSource: mysqlFieldTohump(data),
      })
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

export default router;
