import express from 'express';
const router = express.Router();
import db from '../utils/db';
import { resTemplate, checkField, dbError, setCondition } from '../utils';
import { codes } from '../utils/config';
import { getUserPermissions } from '../utils/business';
import { mysqlFieldTohump } from '../utils/function';



/**
 * @api {post} /api/questionBand/class/add
 * @apiName 新增分类
 * @apiGroup questionBand
 *
 * @apiParam {String} label 文本
 * @apiParam {Number} value 
 * @apiParam {Number} status 0|1 
 */
router.post('/class/add', async(req, res) => {
  getUserPermissions(req, false).then(async(data) => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { label, status = 0 } = req.body;

    if (checkField(label, res, '题库分类名')) return;
  
    const isExistPromise = new Promise((resolve, reject) => {
      const sql = `SELECT id FROM question_bank_class WHERE label=?`;
      db.query(sql, label, (err, data) => {
        if (err) {
          dbError(err, res);
          return;
        }
  
        if (data.length === 0) {
          resolve(true);
          return;
        }
        reject('题库分类值已存在')
      });
    })
  
    const addPromise = new Promise((resolve, reject) => {
      const sql = `INSERT INTO question_bank_class(label, create_time, status, uid) VALUES(?, ?, ?, ?)`;
      const createTime = new Date();
      db.query(sql, [label, createTime, status, uid], (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        if (result.insertId) {
          resolve({ id: result.insertId, createTime });
          return;
        }
        reject('新增失败')
      })
    })
  
    await Promise.all<any>([isExistPromise, addPromise]).then(result => {
      const addInfo = result[1];
      resTemplate(codes.success, '新增成功', res, { 
        label,
        ...addInfo
      });
    }).catch(err => {
      resTemplate(codes.error, err || '新增失败 ', res);
    })

  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {get} /api/questionBand/class/list
 * @apiName 分类下拉列表
 * @apiGroup questionBand
 *
 * @apiParam {String} label 文本
 * @apiParam {Number} value 
 * @apiParam {Number} status 0 ｜1 
 */
router.get('/class/list', (req, res) => {
  const { status = 1 } = req.query;
  const condition = status === '' ? '' : setCondition([{ fieldName: 'qbc.status', value: Number(status) }]);
  const sql = `
    SELECT
      qbc.*,
      users.userName
    FROM
      question_bank_class qbc
    LEFT JOIN users ON users.uid = qbc.uid 
    ${condition}
  `;
  db.query(sql, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }
    resTemplate(codes.success, '查询成功', res, mysqlFieldTohump(data));
  })
})

/**
 * @api {post} /api/questionBand/class/page
 * @apiName 分类下拉列表
 * @apiGroup questionBand
 *
 * @apiParam {String} label 文本
 * @apiParam {Number} value 
 * @apiParam {Number} status 0 ｜1 
 * @apiParam {Number} current 
 * @apiParam {Number} pageSize 
 */
 router.post('/class/page', async(req, res) => {
  const { status = 1, current = 1, pageSize = 20 } = req.body;
  const condition = status === '' ? '' : setCondition([{ fieldName: 'qbc.status', value: Number(status) }]);
  const totalPromise = new Promise(resolve => {
    const sql = `SELECT COUNT(id) total FROM question_bank_class qbc ${condition}`;
    db.query(sql, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }

      resolve(mysqlFieldTohump(result));
    })
  })

  const selectPromise = new Promise(resolve => {
    const sql = `
      SELECT
        qbc.*,
        users.userName,
        users.id userId
      FROM
        question_bank_class qbc
      LEFT JOIN users ON users.uid = qbc.uid 
      ${condition}
      LIMIT ${(current - 1) * pageSize}, ${pageSize} 
    `;
    db.query(sql, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }

      resolve(mysqlFieldTohump(data));
    })
  })

  await Promise.all<any>([totalPromise, selectPromise]).then(datas => {
    const total = datas[0][0].total || 0;
    const data = datas[1];

    resTemplate(
      codes.success, 
      '查询成功', 
      res, 
      {
        total,
        dataSource: mysqlFieldTohump(data),
        current,
        pageSize,
      }
    );
  })
})

/**
 * @api {post} /api/questionBand/class/updateStatus
 * @apiName 分类下拉列表
 * @apiGroup questionBand
 *
 * @apiParam {String} label 文本
 * @apiParam {Number} ID  
 * @apiParam {Number} auditReason  审核原因
 */
router.post('/class/updateStatus', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { status = 1, id, auditReason } = req.body;
    const sql = `
      UPDATE question_bank_class SET 
        status = ?,
        audit_uid = ?,
        audit_time = ?,
        audit_reason = ?
      WHERE
        id = ?
    `;
  
    if (checkField(id, res, '分类ID')) return;
  
    const values = [Number(status), uid, new Date(), auditReason, id];
    db.query(sql, values, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.affectedRows) {
        resTemplate(codes.success, '修改成功', res);
        return;
      }
      resTemplate(codes.error, '修改失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {delete} /api/questionBand/class/delete
 * @apiName 删除分类
 * @apiGroup questionBand
 *
 * @apiParam {Number} id  Id
 */
router.delete('/class/delete', async(req, res) => {
  getUserPermissions(req).then(async(data) => {
    const { id } = req.body;
  
    if (checkField(id, res, '分类ID')) return;
  
    // 分类下是否还有题
    const existQuestionPromise = new Promise((resolve, reject) => {
      const sql = `SELECT COUNT(id) total FROM question_bank WHERE class_id= ?`;
      db.query(sql, id, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
  
        const [first] = result;
        if (first.total > 0) {
          reject(`删除失败！该分类下还有${first.total}条面试题`);
          return;
        }
        resolve(true);
      }) 
    })
  
     // 分类下是否还有编程语言
    const existLanguagePromise = new Promise((resolve, reject) => {
      const sql = `SELECT COUNT(id) total FROM question_bank_language WHERE class_id= ?`;
      db.query(sql, id, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
  
        const [first] = result;
        if (first.total > 0) {
          reject(`删除失败！该分类下还有${first.total}条编程语言`);
          return;
        }
        resolve(true);
      }) 
    })
  
    await Promise.all([existQuestionPromise, existLanguagePromise]).then(datas => {
      const sql = `DELETE FROM question_bank_class WHERE id=?`;
      db.query(sql, id, (err, result) => {
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
    }).catch(err => {
      resTemplate(codes.error, err || '删除失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {put} /api/questionBand/class/update
 * @apiName 编辑分类
 * @apiGroup questionBand
 *
 * @apiParam {Number} value  Value
 * @apiParam {String} label  Label
 * @apiParam {Number} id 分类ID
 */
router.put('/class/update', async(req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { label, id } = req.body;
  
    if (checkField(id, res, '分类ID')) return;
    if (checkField(label, res, '分类Label')) return;
  
    const sql = `UPDATE question_bank_class SET label=? WHERE id=?`;
    db.query(sql, [label, id], (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
  
      if (result.affectedRows) {
        resTemplate(codes.success, '修改成功', res);
        return;
      }
      resTemplate(codes.error, '修改失败', res);
    })

  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})


/**
 * @api {post} /api/questionBand/classAndlanguage
 * @apiName 分类及编程列表
 * @apiGroup questionBand
 * 
 * @apiParam {Number} status  status
 * @apiParam {String} label  文本
 */
router.post('/classAndlanguage', (req, res) => {
  const { status, label } = req.body;

  const condition = setCondition([
    { fieldName: 'status', value: status },
    {fieldName: 'label', value: label, fuzzy: true }
  ]);
  const classPromise = new Promise(resolve => {
    const sql = `SELECT id, label, create_time, status FROM question_bank_class ${condition}`;
    db.query(sql, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      data.map((item: any) => {
        item.childList = [];
      })
      resolve(mysqlFieldTohump(data));
    })
  })

  const languagePromise = new Promise(resolve => {
    const sql = `SELECT id, label, create_time, class_id, status FROM question_bank_language`;
    db.query(sql, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      resolve(mysqlFieldTohump(data));
    })
  })

  Promise.all<any>([classPromise, languagePromise]).then(datas => {
    const classData: any[] = datas[0];
    const languageData: any[] = datas[1];
    languageData.map(item => {
      const classItem = classData.find(classItem => classItem.id === item.classId);
      if (classItem) {
        classItem.childList.push(item);
      }
    })
    resTemplate(codes.success, '查询成功', res, mysqlFieldTohump(classData));
  })
})

/**
 * @api {post} /api/questionBand/language/add
 * @apiName 新增编辑语言
 * @apiGroup questionBand
 *
 * @apiParam {String} label 文本
 * @apiParam {Number} value 
 * @apiParam {Number} classId 
 */
router.post('/language/add', async(req, res) => {
  getUserPermissions(req).then(async(data) => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { label, classId, status = 0 } = req.body;
  
    if (checkField(label, res, '编程语言文本')) return;
    if (checkField(classId, res, '题库分类值')) return;
  
    // 分类是否存在
    const classisExistPromise = new Promise((resolve, reject) => {
      const sql = `SELECT id FROM question_bank_class WHERE id=?`;
      db.query(sql, classId, (err, data) => {
        if (err) {
          dbError(err, res);
          return;
        }
  
        if (data.length) {
          resolve(true);
          return;
        }
        reject('题库分类Value不存在')
      });
    })
  
    // 是否存在已添加的
    const isExistPromise = new Promise((resolve, reject) => {
      const sql = `SELECT id FROM question_bank_language WHERE label=?`;
      db.query(sql, label, (err, data) => {
        if (err) {
          dbError(err, res);
          return;
        }
  
        if (data.length === 0) {
          resolve(true);
          return;
        }
        reject('题库编程语言Value或者Label已存在')
      });
    })
  
    const addPromise = new Promise((resolve, reject) => {
      const sql = `INSERT INTO question_bank_language(class_id, label, create_time, uid, status) VALUES(?, ?, ?, ?, ?);`;
      const createTime = new Date();
      db.query(sql, [classId, label, createTime, uid, status], (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
  
        if (result.insertId) {
          resolve({ id: result.insertId, createTime });
          return;
        }
        reject('新增失败')
      })
    })
  
    await Promise.all<any>([classisExistPromise,isExistPromise, addPromise]).then(result => {
      const addInfo = result[2];
      resTemplate(codes.success, '新增成功', res, { 
        label,
        ...addInfo
      });
    }).catch(err => {
      resTemplate(codes.error, err || '新增失败 ', res);
    })

  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/questionBand/language/list
 * @apiName 新增编辑语言
 * @apiGroup questionBand
 */
router.get('/language/list', (req, res) => {
  const sql = `SELECT qbl.*, users.userName FROM question_bank_language qbl LEFT JOIN users ON users.uid = qbl.uid`;
  db.query(sql, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }

    resTemplate(codes.success, '查询成功', res, mysqlFieldTohump(data));
  })
})


/**
 * @api {get} /api/questionBand/language/page
 * @apiName 编程语言分页
 * @apiGroup questionBand
 *
 * @apiParam {String} label 文本
 * @apiParam {Number} value 
 * @apiParam {Number} classId 
 * @apiParam {Number} current 
 * @apiParam {Number} pageSize 
 */
router.post('/language/page', async(req, res) => {
  const { classId, status = 1, current = 1, pageSize = 20  } = req.body;
  const condition = status === '' ? setCondition([
    { fieldName: 'qbl.class_id', value: classId },
  ]) : setCondition([
    { fieldName: 'qbl.status', value: Number(status) },
    { fieldName: 'qbl.class_id', value: classId },
  ]);
  const totalPromise = new Promise(resolve => {
    const sql = `SELECT COUNT(id) total FROM question_bank_language qbl ${condition}`;
    db.query(sql, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }

      resolve(mysqlFieldTohump(result));
    })
  })

  const selectPromise = new Promise(resolve => {
    const sql = `
      SELECT
        qbl.*,
        users.userName,
        qbc.label classLabel
      FROM
        question_bank_language qbl
      LEFT JOIN users ON users.uid = qbl.uid
      LEFT JOIN question_bank_class qbc ON qbl.class_id = qbc.id
      ${condition}
      LIMIT ${(current - 1) * pageSize}, ${pageSize} 
    `;
    db.query(sql, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }

      resolve(mysqlFieldTohump(data));
    })
  })

  await Promise.all<any>([totalPromise, selectPromise]).then(datas => {
    const total = datas[0][0].total || 0;
    const data = datas[1];

    resTemplate(
      codes.success, 
      '查询成功', 
      res, 
      {
        total,
        dataSource: mysqlFieldTohump(data),
        current,
        pageSize,
      }
    );
  })
})

/**
 * @api {post} /api/questionBand/language/updateStatus
 * @apiName 分类下拉列表
 * @apiGroup questionBand
 *
 * @apiParam {String} label 文本
 * @apiParam {Number} ID  
 * @apiParam {Number} auditReason  审核原因
 */
router.post('/language/updateStatus', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { status = 1, id, auditReason } = req.body;
    const sql = `
      UPDATE question_bank_language SET 
        status = ?,
        audit_uid = ?,
        audit_time = ?,
        audit_reason = ?
      WHERE
        id = ?
    `;
  
    if (checkField(id, res, '分类ID')) return;
  
    const values = [Number(status), uid, new Date(), auditReason, id];
    db.query(sql, values, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.affectedRows) {
        resTemplate(codes.success, '修改成功', res);
        return;
      }
      resTemplate(codes.error, '修改失败', res);
    })

  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/questionBand/language/delete
 * @apiName 删除编程语言
 * @apiGroup questionBand
 *
 * @apiParam {Number} id  Id
 */
router.delete('/language/delete', async(req, res) => {
  getUserPermissions(req).then(async(data) => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { id } = req.body;
  
    if (checkField(id, res, '编程语言ID')) return;
  
    // 分类下是否还有题
    const existQuestionPromise = new Promise((resolve, reject) => {
      const sql = `SELECT COUNT(id) total FROM question_bank WHERE class_id= ?`;
      db.query(sql, id, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
  
        const [first] = result;
        if (first.total > 0) {
          reject(`删除失败！该分类下还有${first.total}条面试题`);
          return;
        }
        resolve(true);
      }) 
    })
  
    await Promise.all([existQuestionPromise]).then(() => {
      const sql = `DELETE FROM question_bank_language WHERE id=?`;
      db.query(sql, id, (err, result) => {
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
    }).catch(err => {
      resTemplate(codes.error, err || '删除失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {put} /api/questionBand/language/update
 * @apiName 编辑分类
 * @apiGroup questionBand
 *
 * @apiParam {Number} value  Value
 * @apiParam {String} label  Label
 * @apiParam {Number} id 分类ID
 */
router.put('/language/update', async(req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { label, id } = req.body;
  
    if (checkField(id, res, '分类ID')) return;
    if (checkField(label, res, '分类Label')) return;
  
    const sql = `UPDATE question_bank_language SET label=? WHERE id=?`;
    db.query(sql, [label, id], (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
  
      if (result.affectedRows) {
        resTemplate(codes.success, '修改成功', res);
        return;
      }
      resTemplate(codes.error, '修改失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})



/**
 * @api {post} /api/questionBand/list
 * @apiName 题库列表
 * @apiGroup questionBand
 *
 * @apiParam {Number} current
 * @apiParam {Number} pageSize 分页大小 
 * @apiParam {Number} status 0 1 2
 * @apiParam {String} issue 问题
 * @apiParam {Number} classId 分类筛选
 * @apiParam {Number} languageValue 分类筛选
 * @apiParam {Boolean} range 是否随机取
 */
router.post('/list', async(req, res) => {
  const { 
    current = 1,
    pageSize = 20,
    status,
    issue,
    classId,
    languageId,
    range,
  } = req.body;
  const condition = setCondition([
    { fieldName: 'qb.status', value: status },
    { fieldName: 'qb.issue', value: issue, fuzzy: true },
    { fieldName: 'qb.class_id', value: classId },
    { fieldName: 'qb.language_id', value: languageId },
  ]);


  const totalPromise = new Promise(resolve => {
    const sql = `SELECT COUNT(qb.id) total FROM question_bank qb ${condition}`;
    db.query(sql, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      resolve(data);
    })
  })

  const selectPromise = new Promise(resolve => {
    const sql = `
    SELECT
      users.userName userName,
      users.id userId,
      qbs.label className,
      qbl.label languageName,
      qb.* 
    FROM
      question_bank qb
      LEFT JOIN users ON qb.uid = users.uid
      LEFT JOIN question_bank_class qbs ON qb.class_id = qbs.id
      LEFT JOIN question_bank_language qbl ON qb.language_id = qbl.id  
    ${condition}
    ${ range ? '' : `LIMIT ${(current - 1) * pageSize}, ${pageSize} `}
    `;
    db.query(sql, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      resolve(data);
    })
  })

  await Promise.all<any>([totalPromise, selectPromise]).then(datas => {
    const [totalInfo, data = []] = datas;
    const rangeData = [];
    if (range) {
      const max = data.length > pageSize ? pageSize : data.length ;
      const min = 1;
      const indexs: number[] = []; // 已存入的数据下标，取过不再用

      while (rangeData.length < max) {
        const random = (Math.floor(Math.random() * (max - min + 1) + min)) - 1;
        if (!indexs.includes(random)) {
          indexs.push(random);
          rangeData.push(data[random]);
        }
      }
    }

    resTemplate(
      codes.success, 
      '查询成功', 
      res, 
      {
        total: totalInfo[0].total,
        current,
        pageSize,
        dataSource: range ? mysqlFieldTohump(rangeData) : mysqlFieldTohump(data),
      }
    );
  })
})

/**
 * @api {post} /api/questionBand/add
 * @apiName 新增题
 * @apiGroup questionBand
 *
 * @apiParam {String} issue 问题
 * @apiParam {String} answer 答案
 * @apiParam {Number} classId 分类
 * @apiParam {Number} languageId 语言
 */
router.post('/add', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { 
      issue,
      answer = null,
      classId,
      languageId,
      status = 0,
    } = req.body;
  
    if (checkField(issue, res, '问题名称')) return;
    if (checkField(classId, res, '分类')) return;
    if (checkField(languageId, res, '编程语言')) return;
    if (checkField(answer, res, '问题答案')) return;
  
    const sql = ` INSERT INTO question_bank (class_id, language_id, issue, answer, uid, create_time, status) VALUES(?, ?, ?, ?, ?, ?, ?)`;
    const values = [classId, languageId, issue, answer, uid, new Date(), status]
    db.query(sql, values, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
  
      if (result.insertId) {
        resTemplate(codes.success, `新增成功! ${status === 0 && '等待管理员审核'}`, res);
        return;
      }
      resTemplate(codes.error, '新增失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})
/**
 * @api {post} /api/questionBand/update
 * @apiName 修改题
 * @apiGroup questionBand
 *
 * @apiParam {Number} id 修改的ID
 * @apiParam {String} issue 问题
 * @apiParam {String} answer 答案
 * @apiParam {String} classId 分类
 * @apiParam {String} languageValue 编程语言
 */
router.post('/update', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { 
      issue,
      answer = null,
      classId,
      languageId,
      id
    } = req.body;
  
    if (checkField(id, res, '题ID')) return;
    if (checkField(issue, res, '问题名称')) return;
    if (checkField(classId, res, '分类')) return;
    if (checkField(languageId, res, '编程语言')) return;
  
    const sql = `UPDATE question_bank SET class_id=?, language_id=?, issue=?, answer=? WHERE id=?`;
    const values = [classId, languageId, issue, answer, id]
    db.query(sql, values, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
  
      if (result.affectedRows) {
        resTemplate(codes.success, `修改成功!`, res);
        return;
      }
      resTemplate(codes.error, '修改失败', res);
    })

  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/questionBand/updateStatus
 * @apiName 题状态修改
 * @apiGroup questionBand
 *
 * @apiParam {String} label 文本
 * @apiParam {Number} ID  
 * @apiParam {Number} auditReason  审核原因
 */
router.post('/updateStatus', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { status = 1, id, auditReason } = req.body;
    const sql = `
      UPDATE question_bank SET 
        status = ?,
        audit_uid = ?,
        audit_time = ?,
        audit_reason = ?
      WHERE
        id = ?
    `;
  
    if (checkField(uid, res, '', '用户未登录')) return;
    if (checkField(id, res, '分类ID')) return;
  
    const values = [Number(status), uid, new Date(), auditReason, id];
    db.query(sql, values, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.affectedRows) {
        resTemplate(codes.success, '修改成功', res);
        return;
      }
      resTemplate(codes.error, '修改失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {delete} /api/questionBand/delete
 * @apiName 删除面试题
 * @apiGroup questionBand
 *
 * @apiParam {String} label 文本
 * @apiParam {Number} id ID  
 */
router.delete('/delete', (req, res) => {
  getUserPermissions(req).then(data => {
    const { id } = req.body;
  
    if (checkField(id, res, '面试题ID')) return;
    const sql = `DELETE FROM question_bank WHERE id=?`;
    db.query(sql, id, (err, result) => {
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
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {get} /api/questionBand/detail
 * @apiName 新增题
 * @apiGroup questionBand
 *
 * @apiParam {Number} id 
 */
router.get('/detail', (req, res) => {
  const { id } = req.query as any;
  const sql = `
    SELECT
      qb.*,
      users.userName,
      users.id userId,
      users1.userName auditUserName,
      users1.id auditUserId,
      qbc.label className,
      qbl.label languageName
    FROM
      question_bank qb
      LEFT JOIN users ON qb.uid = users.uid
      LEFT JOIN users users1 ON qb.audit_uid=users1.uid
      LEFT JOIN question_bank_class qbc ON qb.class_id=qbc.id
      LEFT JOIN question_bank_language qbl ON qb.language_id=qbl.id
    WHERE
      qb.id=?
  `;
  if (checkField(id, res, '面试题ID')) return;
   
  db.query(sql, id, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }
    if (data.length) {
      resTemplate(codes.success, '查询成功', res, mysqlFieldTohump(data[0]));
      return;
    }
    resTemplate(codes.error, '面试题不存在', res);
  })
})


export default router;