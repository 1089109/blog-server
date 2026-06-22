/*
 * @Author: HuangChaoYi
 * @email: 1089109@qq.com
 * @Date: 2021-10-14 06:51:54
 * @LastEditTime: 2022-03-05 17:20:47
 * 
 * 分类系统
 */
import express from 'express';
import db from '../utils/db';
import { resTemplate, checkField, dbError, setCondition } from '../utils';
import { codes } from '../utils/config';
import { getType, mysqlFieldTohump } from '../utils/function';
import { getUserPermissions } from '../utils/business';


const router = express.Router();


/**
 * @api {post} /api/class/totalClass
 * @apiName 分类列表
 * @apiGroup Class
 *
 */
router.get('/totalClass', (req: any, res: any) => {
  const { current = 1, pageSize = 20 } = req.query;
  const sql = `SELECT
      cp.id id,
      cp.update_uid,
      cp.text text,
      cp.create_time,
      class_child.id cid,
      class_child.text cText,
      class_parent_id,
      class_child.create_time cCreateTime,
      userName
    FROM
      class_parent AS cp
      LEFT JOIN class_child ON cp.id = class_child.class_parent_id
      LEFT JOIN users ON cp.create_uid = users.uid LIMIT ${(current - 1) * pageSize}, ${pageSize} `;
  db.query(sql, (err, result) => {
    err && dbError(err, res);
    const newArray: any[] = [];
    const ids: number[] = []; // id是唯一的，可以用这种方式
    const parentData: any[] = mysqlFieldTohump(result);

    if (parentData.length === 0) {
      resTemplate(codes.success, '查询成功', res, []);
      return;
    }

    parentData.forEach( (item: any) => {
      const childList = [];
      const { id } =  item;
      const handleChildren = function() {
        return {
          id: item.cid,
          value: item.cCode,
          label: item.cText,
          text: item.cText,
          classParentId: item.classParentId,
          createTime: item.cCreateTime,
          userName: item.userName,
          icon: item.cIcon,
        };
      }

      // 已经存在，那就是二级分类了
      if (ids.includes(id)) {
        const index = newArray.findIndex(newItem => newItem.id === id);
        if (index > -1) {
          newArray[index].childList.push(handleChildren());
          newArray[index].childTotal += 1;
        }
        return;
      }
      ids.push(id);

      // 第一条父级也有子级时
      if (id === item.classParentId) {
        childList.push(handleChildren());
      }

      newArray.push({
        id: item.id,
        value: item.id,
        label: item.text,
        text: item.text,
        createTime: item.createTime,
        icon: item.icon,
        userName: item.userName,
        childList,
        childTotal: childList.length
      })
    })
    resTemplate(200, '查询成功', res, {
      total: newArray.length,
      list: newArray,
    })
  })
})

/**
 * @api {get} /api/class/parent/list
 * @apiName 所有一级分类
 * @apiGroup Class
 */
 router.get('/parent/list', (req, res) => {
  const selectSql = 'SELECT id, text FROM class_parent';
  db.query(selectSql, (err, result) => {
    if (err) {
      dbError(err, res);
      return;
    }
    resTemplate(codes.success, '查询成功', res, mysqlFieldTohump(result));
  })
})

/**
 * @api {get} /api/class/parent/:id
 * @apiName 获取一级分类详情
 * @apiGroup Class
 *
 * @apiParam {String} id 分类Id 
 */
 router.get('/parent/:id', (req, res) => {
  const { id } = req.params;
  if (checkField(id, res, 'ID')) return;

  const querySql = 'SELECT * FROM class_parent WHERE id=?';
  db.query(querySql, id, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }
    if (!data.length) {
      resTemplate(codes.error, '数据不存在', res);
      return;
    }
    resTemplate(codes.success, '查询成功', res, mysqlFieldTohump(data[0]));
  })
})


/**
 * @api {put} /api/class/parent/:id
 * @apiName 更新一级分类
 * @apiGroup Class
 *
 * @apiParam {String} id 分类Id 
 */
 router.put('/parent/:id', (req, res) => {
  getUserPermissions(req).then(data => {
    const { id } = req.params;
    const { text } = req.body;
    const { userInfo } = data;
  
    if (checkField(id, res, '分类ID')) return;
    if (checkField(text, res, 'Text')) return;
  
    // 是否有数据
    const existId = 'SELECT * FROM class_parent WHERE id=?';
    // 修改语句
    const updateSql = `UPDATE class_parent SET text=?, update_uid=?, update_time=? WHERE id = ?`;
    // 更新的code或者text是否已存在
    const updateExistSQL = 'SELECT count(id) AS count FROM class_parent WHERE (text=?) AND id!=?';
    db.query(existId, id, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (!data.length) {
        resTemplate(codes.error, '数据不存在', res);
        return;
      }
  
      db.query(updateExistSQL, [text, id], (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        if (result[0].count > 0) {
          resTemplate(codes.error, '数据库已经存在重复的Text', res)
          return;
        }
  
        db.query(updateSql, [text, userInfo?.uid??'0', new Date(), id], (err, data) => {
          if (err) {
            dbError(err, res);
            return;
          }
          if (!data.affectedRows) {
            resTemplate(codes.updateError, codes.updateErrorText, res);
            return;
          }
          resTemplate(codes.success, '更新成功', res);
        })
      })
    }); 
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})


/**
 * @api {post} /api/class/addClassParent
 * @apiName 新增一级分类
 * @apiGroup Class
 *
 * @apiParam {String} text Text
 */
 router.post('/addClassParent', async(req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const { text } = req.body;

    if (checkField(text, res, '分类名字')) return;
  
    const sql = `INSERT INTO class_parent (id, text, create_uid, create_time) VALUES(?, ?, ?, ?)`;
    const selectSql = `SELECT text from class_parent WHERE text=?`;
    const querySql = `
      SELECT
      cp.*,
      users.userName 
    FROM
      class_parent AS cp
      LEFT JOIN users ON cp.create_uid = users.uid 
    WHERE
      cp.id = ?`;
    const values = [null, text, userInfo?.uid??'0', new Date()];



  db.query(selectSql, text, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.length > 0) {
        resTemplate(codes.error, `添加的教程(${text})名称已存在`, res);
        return;
      }

      db.query(sql, values, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        if (result.insertId) {
          db.query(querySql, result.insertId, (err, newResult) => {
            if (err) {
              dbError(err, res);
              return;
            }
  
            if (newResult.length > 0) {
              const first = newResult[0];
              resTemplate(200, '新增成功', res, {
                ...first,
                value: first.code,
                label: first.text,
                childList: [],
                childTotal: 0,
              });
              return;
            }
            resTemplate(codes.error, '新增失败', res);
          })
        }
      })
    }); 
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})


/**
 * @api {post} /api/class/delete
 * @apiName 删除分类（一级二级分类）
 * @apiGroup Class
 *
 * @apiParam {String} type child子类 parent父类
 * @apiParam {String} id 删除Id 
 */
 router.delete('/delete', (req, res) => {
  getUserPermissions(req).then(data => {
    const { type, id } = req.body;
    if (checkField(type, res, '类型')) return;
    if (checkField(id, res, 'ID')) return;
    if (! ['parent', 'child'].includes(type)) {
      resTemplate(200, '类型不正确', res);
      return;
    }
  
    if (type === 'parent') {
      // 查询要删除的父类是否有子类
      const queryCountSql = `
        SELECT
          COUNT( class_child.id ) count 
        FROM
          class_parent AS cp
          LEFT JOIN class_child ON cp.id = class_child.class_parent_id
        WHERE
          cp.id = ?`;
      const idExistSql = `SELECT id FROM class_parent WHERE id=?`;
      const deleteSql = 'DELETE FROM class_parent WHERE id=?';
      db.query(idExistSql, id, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        if (result.length === 0) {
          resTemplate(codes.error, '删除的分类ID不存在', res);
          return;
        }
  
        db.query(queryCountSql, id, (err, result) => {
          if (err) {
            dbError(err, res);
            return;
          }
          if (Array.isArray(result) && result.length > 0) {
            if (result[0].count > 0) {
              resTemplate(codes.error, `无法删除当前父类，父类下还有${result[0].count}个子类`, res);
              return;
            }
            db.query(deleteSql, id, (err, result) => {
              if (err) {
                dbError(err, res);
                return;
              }
              
              if (result.affectedRows)  {
                resTemplate(codes.success, '删除成功', res);
                return;
              }
              resTemplate(codes.error, '删除失败', res);
            })
          }
        })
      })
  
      return;
    }
  
    if (type === 'child') {
      // 是否有文章关联子类ID
      const isAssociated = `
        SELECT
          COUNT( class_article.id ) count 
        FROM
          class_child AS cc
          LEFT JOIN class_article ON cc.id = class_article.class_child_id
        WHERE
          cc.id = ?`;
      const existId = 'SELECT id FROM class_child WHERE id=?';
      const deleteSQL = 'DELETE FROM class_child WHERE id=?';
  
      db.query(existId, id, (err, data) => {
        if (err) {
          dbError(err, res);
          return;
        }
        if (data.length === 0) {
          resTemplate(codes.error, '数据不存在', res);
          return;
        }
  
        db.query(isAssociated, id, (err, result) => {
          if (err) {
            dbError(err, res);
            return;
          }
          if (result[0].count > 0 ) {
            resTemplate(codes.error, `有${result[0].count}文章关联该子类, 无法删除`, res);
            return;
          }
  
          db.query(deleteSQL, id, (err, result) => {
            if (err) {
              dbError(err, res);
              return;
            }
            
            if (!result.affectedRows)  {
              resTemplate(codes.error, '删除失败', res);
              return;
            }
            resTemplate(codes.success, '删除成功', res);
          })
        })
      })
    }
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/class/addClassChild
 * @apiName 新增二级分类
 * @apiGroup Class
 *
 * @apiParam {Number} classParentId 一级分类的Id
 * @apiParam {String} text Text
 */
 router.post('/addClassChild', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'0';
    const { text, classParentId } = req.body;
  
    if (checkField(classParentId, res, '一级分类ID不能为空！二级分类必须在一级分类下')) return;
    if (checkField(text, res, '一级分类名字')) return;
  
    const selectParentCodeSql = 'SELECT id FROM class_parent WHERE id=?';
    const existCode = "SELECT * FROM class_child WHERE text=?"
    const insertSql = `INSERT INTO class_child (id, text, create_uid, create_time, class_parent_id) VALUES(?, ?, ?, ?, ?)`;
    const querySql = `
      SELECT
        cp.*,
        users.userName 
      FROM
        class_child AS cp
        LEFT JOIN users ON cp.create_uid = users.uid 
      WHERE
        cp.id = ?`;
    db.query(selectParentCodeSql, classParentId, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (!result.length) {
        resTemplate(codes.error, '一级分类ID不存在', res);
        return;
      } 
      db.query(existCode, text, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        if (result.length) {
          resTemplate(codes.error, '二级分类已经存在', res, result);
          return;
        }
        db.query(insertSql, [null, text, uid, new Date(), classParentId], (err, result) => {
          if (err) {
            dbError(err, res);
            return;
          }
          if (result.insertId) {
            db.query(querySql, result.insertId, (err, result) => {
              if (err) {
                dbError(err, res);
                return;
              }
              resTemplate(codes.success, '插入成功', res, result[0]);
            })
            return;
          }
          resTemplate(codes.error, '插入失败', res);
        })
      })
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
});

/**
 * @api {get} /api/class/child/:id
 * @apiName 获取二级分类详情
 * @apiGroup Class
 *
 * @apiParam {String} id 分类Id 
 */
 router.get('/child/:id', (req, res) => {
  const {id } = req.params;
  if (checkField(id, res, 'ID')) return;

  const querySql = 'SELECT * FROM class_child WHERE id=?';
  db.query(querySql, id, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }
    if (!data.length) {
      resTemplate(codes.error, '数据不存在', res);
      return;
    }
    resTemplate(codes.success, '查询成功', res, mysqlFieldTohump(data[0]));
  })
})

/**
 * @api {put} /api/class/child/:id
 * @apiName 更新二级分类
 * @apiGroup Class
 *
 * @apiParam {String} id 分类Id 
 */
router.put('/child/:id', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const { id } = req.params;
    const { text, classParentId } = req.body;
    const uid = userInfo?.uid??'0';
  
    if (checkField(uid, res, '用户未登录')) return;
    if (checkField(id, res, 'ID')) return;
    if (checkField(classParentId, res, '一级ID')) return;
    if (checkField(text, res, 'Text')) return;
  
    // 是否有数据
    const existId = 'SELECT * FROM class_child WHERE id=?';
    // 修改语句
    const updateSql = `UPDATE class_child SET class_parent_id=?,text=?, update_uid=?, update_time=? WHERE id = ?`;
    // 更新的code或者text是否已存在
    const updateExistSQL = 'SELECT count(id) AS count FROM class_child WHERE text=? AND id!=?';
    db.query(existId, id, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (!data.length) {
        resTemplate(codes.error, '数据不存在', res);
        return;
      }
  
      db.query(updateExistSQL, [text, id], (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        if (result[0].count > 0) {
          resTemplate(codes.error, '数据库已经存在重复的Text', res)
          return;
        }
  
        db.query(updateSql, [classParentId, text, uid, new Date(), id], (err, data) => {
          if (err) {
            dbError(err, res);
            return;
          }
          if (!data.affectedRows) {
            resTemplate(codes.updateError, codes.updateErrorText, res);
            return;
          }
          resTemplate(codes.success, '更新成功', res);
        })
      })
    });
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})


 /**
 * @api {post} /api/class/pariseAndCollect
 * @apiName 分类文章的点赞和收藏
 * @apiGroup Class
 *
 * @apiParam {String} articleId 文章ID
 * @apiParam {String} type collect：收藏 parise点赞 
 */
router.post('/pariseAndCollect', (req, res) => {
  getUserPermissions(req).then((data) => {
    const { userInfo } = data;
    const { articleId, type } = req.body;
    const uid = userInfo?.uid??'';
    const createTime = new Date();
  
    if (checkField(articleId, res, '文章ID')) return;
    if (checkField(type, res, 'Type')) return;
    
  
    const insert = `INSERT INTO article_other (uid, type, create_time, article_id) VALUES(?, ?, ?, ?)`;
    const values = [uid, type, createTime, articleId];
    db.query(insert, values, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
  
      if (result.insertId) {
        resTemplate(codes.success, `${ type === 'collect' ? '收藏' : '点赞' }成功`, res, {
          id: result.insertId,
          uid,
          createTime,
          articleId,
          type,
        });
        return;
      }
      resTemplate(codes.error, '评论失败，请重试', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {get} /api/class/pariseAndCollect
 * @apiName 获取分类文章的点赞和收藏信息
 * @apiGroup Class
 *
 * @apiParam {String} articleId 文章ID
 */
router.get('/pariseAndCollect', (req, res) => {
  getUserPermissions(req).then((data) => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { articleId } = req.query;
    const condition = setCondition([
      { fieldName: 'article_id', value: articleId },
      { fieldName: 'uid', value: uid },
    ])
    const selectSql = `SELECT id, uid, type, article_id, create_time from  article_other ${condition}`;
    
    db.query(selectSql, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      resTemplate(codes.success, '查询成功', res, mysqlFieldTohump(data));
    });
  }).catch(err => {
    // code用999的原因是，进页面的时候会直接跳转，很奇怪的体验
    resTemplate(err.code || codes.error, err.message, res);
  })
});
  

  /**
 * @api {delelte} /api/class/pariseAndCollect
 * @apiName 评论分类文章
 * @apiGroup Class
 *
 * @apiParam {String} articleId 文章ID
 */
router.delete('/pariseAndCollect', (req, res) => {
  getUserPermissions(req).then((data) => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { articleId, type } = req.body;
  
    if (checkField(articleId, res,'文章ID')) return;
    if (checkField(type, res, 'Type不能为空')) return;
    const condition = setCondition([
      { fieldName: 'article_id', value: articleId },
      { fieldName: 'uid', value: uid },
      { fieldName: 'type', value: type },
    ])
  
    const selectSql = `DELETE FROM  article_other ${condition}`;
    
    db.query(selectSql, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.affectedRows === 1) {
        resTemplate(codes.success, '删除成功', res, { 
          type,
          articleId,
          uid,
        });
        return;
      }
  
      resTemplate(codes.error, '删除失败', res);
    });
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
});


/**
 * @api {get} /api/class/comments
 * @apiName 分类文章的评论
 * @apiGroup Class
 *
 * @apiParam {String} id 分类Id 
 */
router.get('/comments', (req, res) => {
  const { id } = req.query as any;
  if (checkField(id, res, '文章ID')) return;

 const select = `
   SELECT
   cc.id,
   cc.uid,
   cc.create_time,
   content,
   article_id,
   level,
   thread,
   u1.face,
   u1.userName userName,
   u2.userName replyName,
   u1.id userId,
   u2.id replyUserId
 FROM
   class_comments cc
   LEFT JOIN users u1 ON cc.uid = u1.uid
   LEFT JOIN users u2 ON cc.correlate_id = u2.uid 
 WHERE
   article_id = ?
 ORDER BY id
 `;
 db.query(select, id, (err, data) => {
   if (err) {
     dbError(err, res);
     return;
   }

   if (data.length > 0) {
     resTemplate(200, '查询成功', res, mysqlFieldTohump(data));
     return;
   }
   resTemplate(codes.success, '文章暂无评论', res, []);
 })
})

/**
 * @api {post} /api/class/comment
 * @apiName 评论分类文章
 * @apiGroup Class
 *
 * @apiParam {String} id 分类Id 
 * @apiParam {String} content 评论内容 
 */
router.post('/comment', (req, res) => {
  getUserPermissions(req, false).then(data => {
    const { userInfo } = data;
    const { uid, userName } = userInfo || {};
    const { id, content, thread = '/', correlateId } = req.body;
  
    if (checkField(id, res, '文章ID')) return;
    if (checkField(content, res, '评论内容')) return;

    const threadStr = typeof thread === 'string' ? thread : '/';
    const commentLevel =
      threadStr === '/' ? 1 : threadStr.split('/').filter(Boolean).length + 1;
  
    const insert = `INSERT INTO class_comments (uid, content, create_time, article_id, level, thread, correlate_id) VALUES(?, ?, ?, ?, ?, ?, ?)`;
    const createTime = new Date();
    const values = [uid, content, createTime, id, commentLevel, threadStr, correlateId ?? null];
    db.query(insert, values, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
  
      if (result.insertId) {
        resTemplate(codes.success, '评论成功', res, {
          createTime,
          id: result.insertId,
          userName
        });
        return;
      }
        
      resTemplate(codes.error, '评论失败，请重试', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
 
})


export default router;