import express, { Request } from 'express';
const router = express.Router();
import { resTemplate, checkField, dbError, codes, setCondition, setSorter } from '../utils';
import { getUserPermissions, setLog } from '../utils/business';
import db from '../utils/db';
import { mysqlFieldTohump } from '../utils/function';
import { resolvePublicAssetUrl } from '../utils/assetUrl';

/**
 * @api {post} /api/banner/add
 * @apiName 新增广告位
 * @apiGroup Banner 
 *
 * @param {Number} bannerId 广告位ID
 * @param {String} name 广告位名称
 * @param {String} href 链接
 * @param {String} img 图片地址
 * @param {Number} status 状态
 */
router.post('/add', (req, res) => {
  getUserPermissions(req).then((data) => {
    const { 
      bannerId,
      name,
      href,
      img, 
      status = 0,
      windowDesc,
      describe,
    } = req.body;
    const { userInfo } = data;
    const uid = userInfo?.uid??'';

    if (checkField(bannerId, res, '广告位ID')) return;
    if (checkField(name, res, '广告位名称')) return;
    if (checkField(href, res, '跳转链接')) return;
    if (checkField(img, res, '显示图片')) return;

    const selectSql = `SELECT COUNT(id) count FROM banners WHERE banner_id=?`;
    const addSql = `
      INSERT INTO banners 
        (banner_id, name, href, img, create_time, uid, status, window_desc, banners.describe) 
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      bannerId,
      name,
      href,
      img,
      new Date(),
      uid,
      status,
      windowDesc ?? null,
      describe ?? null,
    ];

    db.query(selectSql, bannerId, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result[0].count) {
        resTemplate(codes.error, '广告位ID已存在', res);
        return;
      }

      db.query(addSql, values, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
  
        if (result.insertId) {
          setLog(req, {
            apiName: '新增广告位',
            title: '广告模块',
            content: `插入了广告位${name}`
          })
          resTemplate(codes.success, '插入成功', res);
          return;
        }
        resTemplate(codes.error, '插入失败', res);
      })
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {put} /api/banner/edit
 * @apiName 修改广告位
 * @apiGroup Banner 
 *
 * @param {Number} bannerId 广告位ID
 * @param {String} name 广告位名称
 * @param {String} href 链接
 * @param {String} img 图片地址
 * @param {Number} status 状态
 * @param {Number} id 数据库的业务ID
 */
router.put('/edit', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { 
      bannerId,
      name,
      href,
      img, 
      status = 0,
      windowDesc,
      describe,
      id,
    } = req.body;

    
    if (checkField(id, res, 'Id')) return;
    if (checkField(bannerId, res, '广告位ID')) return;
    if (checkField(name, res, '广告位名称')) return;
    if (checkField(href, res, '跳转链接')) return;
    if (checkField(img, res, '显示图片')) return;

    const updateSql = `UPDATE banners SET 
        banner_id=?, 
        banners.name=?, 
        href=?, 
        img=?, 
        banners.status=?, 
        window_desc=?, 
        banners.describe=?, 
        update_time=?,
        update_uid=?  
      WHERE id=?
    `;
    const values = [
      bannerId,
      name,
      href,
      img,
      status,
      windowDesc ?? null,
      describe ?? null,
      new Date(),
      uid,
      id,
    ];
    db.query(updateSql, values, (err, result ) => {
      if (err) {
        dbError(err, res);
        return;
      }
      const content = `${userInfo?.userName}修改了广告位资料，ID=${id}`;
      let code = codes.success, msg = '修改成功'
      
      if (!result.affectedRows) {
        code = codes.error;
        msg = '修改失败';
      }

      setLog(req, {
        apiName: '修改广告位资料',
        title: '广告模块',
        content,
        code,
      })

      resTemplate(code, msg , res);
    })

  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})


/**
 * @api {post} /api/banner/list
 * @apiName 新增广告位
 * @apiGroup Banner 
 *
 * @param {Number} current 当前页数
 * @param {Number} pageSize 页大小
 * @param {Object} sorter 筛选条件
 * @param {String} name 广告位名称
 */
router.post('/list', (req, res ) => {
  const { 
    current = 1,
    pageSize = 20,
    sorter = { 'bannerId': 'ASC'},
    name,
    bannerId
  } = req.body;

  let condition = setCondition([
    { fieldName: 'name', value: name, fuzzy: true },
    { fieldName: 'banner_id', value: bannerId},
  ]);

  const selectSql = `SELECT banners.*, users.userName FROM banners LEFT JOIN users ON banners.uid =users.uid ${condition}  ${setSorter(sorter, 'banners')}  LIMIT ${(current - 1) * pageSize}, ${pageSize}`;
  const totalSql = `SELECT count(id) count FROM banners`;
  let total = 0;

  db.query(totalSql, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }

    total = data[0].count;
  })

  db.query(selectSql, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }

    resTemplate(codes.success, '查询成功', res, {
      total,
      current,
      pageSize,
      dataSource: mysqlFieldTohump(data),
    });
  })
})

/**
 * @api {delete} /api/banner/delete
 * @apiName 删除广告位
 * @apiGroup Banner 
 * 
 * @param {Number} id 删除的广告位ID
 */
router.delete('/delete', (req, res) => {
  getUserPermissions(req).then(data => {
    const { id } = req.body;
    const deleteSql = `DELETE FROM banners WHERE id=?`;
    const selectSql = `SELECT name FROM banners WHERE id=?`;
    const { userInfo } = data;

    if (checkField(id, res, '广告位ID'))return;

    db.query(selectSql, id, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      const bannerInfo = data[0]

      if (!bannerInfo) {
        resTemplate(codes.error, '要删除的广告位ID不存在', res);
        return;
      }

      db.query(deleteSql, id, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }

        if (result.affectedRows) {
          setLog(req, {
            apiName: '删除广告位',
            title: '广告模块',
            content: `${userInfo?.userName}删除了广告位：${bannerInfo.name}`
          })
          resTemplate(codes.success, '删除成功', res);
          return;
        }
        resTemplate(codes.error, '删除失败', res);
      })
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/banner/getBanners
 * @apiName 要查找的广告位
 * @apiGroup Banner 
 *
 * @param {Number Array} bannerIds 要查找的广告位
 */
router.post('/getBanners', (req, res) => {
  const { bannerIds } = req.body;
  
  if (checkField(bannerIds, res, '广告位ID不能为空')) return;

  if (!Array.isArray(bannerIds)) {
    resTemplate(codes.error, 'bannerIds参数必须是一个数据', res);
    return;
  }

  if (bannerIds.length === 0) {
    resTemplate(codes.error, '须指定广告位', res);
    return;
  }

  const selectSql =`SELECT * FROM banners WHERE banner_id in(${bannerIds.join(', ')}) AND banners.status = 1`;
  db.query(selectSql, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }

    resTemplate(codes.success, '查询成功', res, mysqlFieldTohump(data).map((item: { img?: string }) => ({
      ...item,
      img: resolvePublicAssetUrl(item.img),
    })));
  })
})

export default router;
