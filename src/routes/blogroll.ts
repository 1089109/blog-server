/*
 * @Author: HuangChaoYi
 * @email: 1089109@qq.com
 * @Date: 2022-02-20 21:48:56
 * @LastEditTime: 2022-02-22 23:21:33
 */
import express, { Request } from 'express'
const router = express.Router();
import { resTemplate, checkField, dbError, codes, setCondition, setSorter } from '../utils';
import { getUserPermissions } from '../utils/business';
import db from '../utils/db';
import { mysqlFieldTohump } from '../utils/function';


/**
 * @api {post} /api/blogroll/apply
 * @apiName 申请友情链接
 * @apiGroup Blogroll
 *
 * @apiParam {String} title 标题
 */
router.post('/apply', (req, res) => {
  const { uid } = req.signedCookies;
  const { webName, link, describe } = req.body;
  if (checkField(uid, res, '', '用户未登录')) return;
  if (checkField(webName, res, '网站名称')) return;
  if (checkField(link, res, '网站链接')) return;
  if (checkField(describe, res, '网站描述')) return;

  const insertSql = "INSERT INTO blogroll(webName, link, `describe`, createTime, uid) VALUES (?, ?, ?, ?, ?)";
  db.query(insertSql, [webName, link, describe, new Date, uid], (err, result) => {
    if (err) {
      dbError(err, res);
      return;
    }
    if (result.insertId) {
      resTemplate(codes.success, '插入成功', res);
      return;
    }
    resTemplate(codes.error, '插入失败', res);
  })
})

/**
 * @api {post} /api/blogroll/list
 * @apiName 友情链接列表()
 * @apiGroup Blogroll
 *
 * @apiParam {String} status 0 未审核 1已审核（默认）
 */
router.get('/list', (req: Request, res) => {
  const { status, webName } = req.query;
  const condition = setCondition([
    { fieldName: 'status', value: status },
    { fieldName: 'webName', value: webName, fuzzy: true }
  ])
  const selectSql = `SELECT id, webName, createTime, blogroll.describe, link, blogroll.status, orderNum, reason FROM blogroll ${condition} ORDER BY orderNum DESC`;
  db.query(selectSql, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }  
    resTemplate(codes.success, '查询成功',res, mysqlFieldTohump(data));
  })
});


/**
 * @api {post} /api/blogroll/add
 * @apiName 申请友情链接
 * @apiGroup Blogroll
 *
 * @apiParam {String} webName 网站标题
 * @apiParam {String} link 网站链接
 * @apiParam {String} describe 网站描述
 * @apiParam {String} reason 申请理由
 */
 router.post('/add', (req, res) => {
  getUserPermissions(req, false).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??0;
  
    const { webName, link, describe, reason = '' } = req.body;
    if (checkField(webName, res, '网站名称')) return;
    if (checkField(link, res, '网站链接')) return;
    if (checkField(describe, res, '网站描述')) return;
    const insertSql = "INSERT INTO blogroll(webName, link, `describe`, createTime, uid, reason) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(insertSql, [webName, link, describe, new Date, uid, reason], (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.insertId) {
        resTemplate(codes.success, '插入成功', res);
        return;
      }
      resTemplate(codes.error, '插入失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/blogroll/audit
 * @apiName 友情链接的审核
 * @apiGroup Blogroll
 *
 * @apiParam {String} status 1同意 2拒绝
 * @apiParam {Number} id 
 */
router.post('/audit', (req, res) => {
  const { status, id } = req.body;
  const updateSql = 'UPDATE blogroll SET `status`=? WHERE id=?';

  if (checkField(status, res, '状态')) return;
  if (checkField(id, res, 'id')) return;

  db.query(updateSql, [status, id], (err, result) => {
    if (err) {
      dbError(err, res);
      return;
    }  

    if (result.affectedRows) {
      resTemplate(codes.success, '核实成功', res);
      return;
    }
    resTemplate(codes.error, '核实失败', res);
  })
});

/**
 * @api {delete} /api/blogroll/delete
 * @apiName 友情链接的审核
 * @apiGroup Blogroll
 *
 * @apiParam {Number} id 
 */
 router.delete('/delete', (req, res) => {
  const { id } = req.body;
  const updateSql = 'DELETE FROM blogroll WHERE id=?';

  if (checkField(id, res, 'id')) return;

  db.query(updateSql, id, (err, result) => {
    if (err) {
      dbError(err, res);
      return;
    }  

    if (result.affectedRows) {
      resTemplate(codes.success, '删除成功', res);
      return;
    }
    resTemplate(codes.error, '删除失败', res);
  })
});

/**
 * @api {post} /api/blogroll/update/order
 * @apiName  更新友情链接的顺序
 * @apiGroup Blogroll
 * 
 * @apiParam {Number} id
 * @apiParam {Number} order 修改的排序号，越大越靠前
 */
router.post('/update/order', (req, res) => {
  const { id, order } = req.body;
  const updateSql = `UPDATE blogroll SET orderNum=? WHERE id=?`;

  if (checkField(id, res, 'id')) return;
  if (checkField(order, res, '排序号不能为空')) return;
  db.query(updateSql, [order, id], (err, result) => {
    if (err) {
      dbError(err, res);
      return;
    }
    if (result.affectedRows) {
      resTemplate(codes.success, '修改成功', res);
      return;
    }
    resTemplate(codes.updateError, '修改失败', res);
  })
})

export default router;
