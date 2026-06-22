import express from 'express'
const router = express.Router();
import { resTemplate, checkField, dbError, codes, setCondition, setSorter } from '../utils';
import db from '../utils/db';
import { moveFile, mysqlFieldTohump } from '../utils/function';
import { getUserPermissions } from '../utils/business';

/**
 * @api {post} /api/article/max
 * @apiName 最多浏览/最多评论/最多收藏的文章
 * @apiGroup Article
 * 
 * @apiParam {Number} current 当前页
 * @apiParam {Number} pageSize 分页大小
 * @apiParam {Boolean} isBrowse 是否返回最多浏览
 * @apiParam {Boolean} isComment 是否返回最多评论
 * @apiParam {Boolean} isCollect 是否返回最多收藏
 * @apiParam {Boolean} isNewArticle 是否返回最新文章
 */
router.post('/max', async (req, res) => {
  const {
    current = 1,
    pageSize = 20,
    isBrowse = false,
    isComment = false,
    isCollect = false,
    isNewArticle = false,
  } = req.body;
  const resultMap = {
    browseList: [],
    commentList: [],
    collectList: [],
    newArticleList: []
  }
  const promiseAll = [];

  if (!isBrowse && !isComment && !isCollect && !isNewArticle) {
    resTemplate(codes.success, '查询成功', res, resultMap);
    return;
  }

  // 最多浏览
  if (isBrowse) {
    const promise = new Promise((resolve, reject) => {
      const select = `
        SELECT 
          ca.id id,
          ca.title,
          cp.text classParentName,
          cc.text classChildName
        FROM 
          class_article ca 
          LEFT JOIN class_parent cp ON ca.class_parent_id = cp.id
          LEFT JOIN class_child cc ON ca.class_child_id = cc.id 
        WHERE ca.status=1 ORDER BY browse_number DESC LIMIT ${(current - 1) * pageSize}, ${pageSize}`;
      db.query(select, (err, data) => {
        if (err) {
          dbError(err, res);
          reject(err);
          return;
        }
        resultMap.browseList = mysqlFieldTohump(data);
        resolve(true);
      })
    });
    promiseAll.push(promise);
  }


  // 最多评论
  if (isComment) {
    const promise = new Promise((resolve, reject) => {
      const select = `
        SELECT
          cc.article_id as article_id,
          count(cc.article_id) commentCount,
          ca.id id,
          ca.title title,
          cp.text classParentName,
          child.text classChildName
        FROM
          class_comments cc
        LEFT JOIN class_article ca ON cc.article_id = ca.id
        LEFT JOIN class_parent cp ON ca.class_parent_id = cp.id
        LEFT JOIN class_child child ON ca.class_child_id = child.id
        GROUP BY (cc.article_id) ORDER BY commentCount DESC LIMIT ${(current - 1) * pageSize}, ${pageSize}
      `;

      db.query(select, (err, data) => {
        if (err) {
          dbError(err, res);
          reject(err);
          return;
        }
        resultMap.commentList = mysqlFieldTohump(data);
        resolve(true);
      })
    })
    promiseAll.push(promise);
  }


  // 最多收藏
  if (isCollect) {
    const promise = new Promise((resolve, reject) => {
      const select = `
        SELECT
          COUNT( other.article_id ) collectCount,
          other.article_id,
          ca.id id,
          ca.id title,
          cp.text classParentName,
          child.text classChildName 
        FROM
          article_other other
          LEFT JOIN class_article ca ON other.article_id = ca.id
          LEFT JOIN class_parent cp ON ca.class_parent_id = cp.id
          LEFT JOIN class_child child ON ca.class_child_id = child.id 
        WHERE
          other.type = 'collect' 
        GROUP BY
          ( other.article_id ) 
        ORDER BY
          collectCount DESC 
        LIMIT ${(current - 1) * pageSize}, ${pageSize}
      `;

      db.query(select, (err, data) => {
        if (err) {
          dbError(err, res);
          reject(err);
          return;
        }
        resultMap.collectList = mysqlFieldTohump(data);
        resolve(true);
      })
    })
    promiseAll.push(promise);
  }


  // 最新文章
  if (isNewArticle) {
    const promise = new Promise((resolve, reject) => {
      const select = `
      SELECT
        ca.id id,
        title,
        description,
        keywords,
        ca.create_time,
        ca.update_time,
        ca.class_parent_id,
        ca.class_child_id,
        thumbnail,
        userName,
        browse_number,
        ca.uid,
        cp.text classParentName,
        cc.text classChildName 
      FROM
        class_article ca
        LEFT JOIN users ON ca.uid = users.uid
        LEFT JOIN class_parent cp ON ca.class_parent_id = cp.id
        LEFT JOIN class_child cc ON ca.class_child_id = cc.id 
      WHERE
        ca.STATUS = 1 
      ORDER BY
        create_time DESC 
      LIMIT ${(current - 1) * pageSize}, ${pageSize}
      `;
      db.query(select, (err, data) => {
        if (err) {
          dbError(err, res);
          reject(err);
          return;
        }
        resultMap.newArticleList = mysqlFieldTohump(data);
        resolve(true);
      })
    })
    promiseAll.push(promise);
  }

  Promise.all(promiseAll).then(() => {
    resTemplate(codes.success, '查询成功', res, resultMap);
  }).catch(err => {
    console.log('/api/article/max error ->', err);
  })
})

/**
 * @api {post} /api/article/news
 * @apiName 最新分章
 * @apiGroup Article
 * 
 * @apiParam {Number} current 当前页
 * @apiParam {Number} pageSize 分页大小
 */
router.post('/news', async (req, res) => {
  const {
    current = 1,
    pageSize = 20,
  } = req.body;

  let condition = setCondition([
    { fieldName: 'ca.status', value: 1 },
  ]);
  const totalSql = `select count(id) total from class_article AS ca ${condition}`;
  const selectSql = `SELECT
      ca.id,
      title,
      description,
      keywords,
      ca.createTime,
      ca.updateTime,
      ca.classParentId,
      ca.classChildId,
      content,
      thumbnail,
      userName,
      browse_number,
      ca.uid,
      cp.text classParentName,
      cc.text classChildName
    FROM
    class_article ca
		LEFT JOIN users ON ca.uid = users.uid
		LEFT JOIN classParent cp ON ca.classParentId = cp.id
		LEFT JOIN classChild cc  ON ca.classChildId = cc.id
    ${condition} ${setSorter({ 'createTime': false })} LIMIT ${(current - 1) * pageSize}, ${pageSize} 
  `;
  const artilceInfoSql = `SELECT article_id, count(type) count, type FROM article_other GROUP BY article_id,type`;
  const commentSql = `SELECT count(id) count, article_id FROM class_comments GROUP BY article_id`; // 统计文章评论id

  const totalPromise = new Promise((resolve, reject) => {
    db.query(totalSql, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      resolve(result);
    });
  })

  const articlePromise = new Promise((resolve, reject) => {
    db.query(selectSql, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      resolve(result)
    });
  })


  const articleInfoPromise = new Promise((resolve, reject) => {
    db.query(artilceInfoSql, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      resolve(result)
    });
  })
  const commentPromise = new Promise((resolve, reject) => {
    db.query(commentSql, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      resolve(result)
    });
  })

  const [totalResult, articleInfo, articleOtherInfo, commentList] = await Promise.all<any>([totalPromise, articlePromise, articleInfoPromise, commentPromise])
  const articleList: any[] = articleInfo as [];

  articleList.map(item => {
    item.parise = 0;
    item.collect = 0;
    item.commentCount = 0; // 评论数量
    articleOtherInfo.map((articleItem: any) => {
      if (item.id === articleItem.articleId) {
        item[articleItem.type] = articleItem.count;
      }
    })

    commentList.map((commentItem: any) => {
      if (item.id === commentItem.articleId) {
        item.commentCount = commentItem.count;
      }
    })
  })


  resTemplate(codes.success, '查询成功', res, {
    total: totalResult[0]?.total || 0,
    current,
    pageSize,
    data: articleList
  });
})


/**
 * @api {post} /api/article/class/list
 * @apiName 查询分类文章
 * @apiGroup Article
 *
 * @apiParam {Number} current 当前页
 * @apiParam {Number} pageSize 分页大小
 * @apiParam {Number} status 状态： 0草稿 1已发布 2回收站
 */
router.post('/class/list', (req, res) => {
  const {
    current = 1,
    pageSize = 20,
    status,
    title,
    classParentId,
    classChildId,
    sorter, // 排序
  } = req.body;

  let condition = setCondition([
    { fieldName: 'title', value: title, fuzzy: true },
    { fieldName: 'ca.status', value: status },
    { fieldName: 'ca.class_parent_id', value: classParentId },
    { fieldName: 'class_child_id', value: classChildId },
  ]);

  const totalSql = `select count(id) total from class_article AS ca ${condition}`;
  const selectSql = `SELECT
      ca.id,
      title,
      description,
      keywords,
      ca.create_time,
      ca.update_time,
      ca.class_parent_id,
      ca.class_child_id,
      thumbnail,
      userName,
      ca.uid,
      cp.text classParentName,
      cc.text classChildName
    FROM
    class_article ca
		LEFT JOIN users ON ca.uid = users.uid
		LEFT JOIN class_parent cp ON ca.class_parent_id = cp.id
		LEFT JOIN class_child cc  ON ca.class_child_id = cc.id
    ${condition} ${setSorter(sorter)} LIMIT ${(current - 1) * pageSize}, ${pageSize}
  `;

  db.query(selectSql, (err, result) => {
    if (err) {
      dbError(err, res);
      return;
    }
    db.query(totalSql, (err, totalResult) => {
      if (err) {
        dbError(err, res);
        return;
      }
      resTemplate(codes.success, '查询成功', res, {
        total: totalResult[0]?.total || 0,
        current,
        pageSize,
        data: mysqlFieldTohump(result),
      });
    });
  })
})


/**
 * @api {post} /api/article/class/add
 * @apiName 新增分类文章
 * @apiGroup Article
 *
 * @apiParam {String} title 标题
 */
router.post('/class/add', (req, res) => {
  getUserPermissions(req).then(tokenData => {
    const { userInfo } = tokenData;
    const uid = userInfo?.uid ?? '';
    const {
      title,
      description = '',
      keywords = '',
      classParentId,
      classChildId,
      content,
      thumbnail,
      status = 1,
    } = req.body;
    const insertSql = `INSERT INTO class_article ( 
      title, description, keywords, create_time, uid, class_parent_id, class_child_id, content, thumbnail, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const data = [
      title,
      description,
      keywords,
      new Date(),
      uid,
      classParentId,
      classChildId,
      content,
      thumbnail,
      status,
    ];

    if (checkField(uid, res, '用户未登录')) return;
    if (checkField(title, res, '标题')) return;
    if (checkField(classParentId, res, '一级分类')) return;
    if (checkField(classChildId, res, '二级分类')) return;
    if (checkField(content, res, '内容')) return;

    db.query(insertSql, data, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.insertId) {
        // 缩略图处理
        if (thumbnail) {
          let lastIndex = thumbnail.lastIndexOf('/');
          let thumbnailName = thumbnail.slice(lastIndex + 1);
          moveFile(lastIndex > -1 ? thumbnailName : thumbnail).then((filePath) => {
            db.query('UPDATE class_article SET thumbnail=? WHERE id=?', [filePath, result.insertId]);
          });
        }
        resTemplate(codes.success, '插入成功', res);
        return;
      }
      resTemplate(codes.error, '插入失败', res)
    })
  }).catch(error => {
    resTemplate(error.code, error.message, res);
  })
})


/**
 * @api {get} /api/article/class/view
 * @apiName 分类文章详情
 * @apiGroup Article
 *
 * @apiParam {Number} id 分类文章id
 */
router.get('/class/view', async (req, res) => {
  const { id } = req.query as any;
  if (checkField(id, res, '文章ID')) return;
  const selectSql = `SELECT
    title,
    keywords,
    description,
    content,
    thumbnail,
    browse_number,
    ca.id,
    ca.status,
    ca.create_time,
    ca.uid,
    ca.class_parent_id,
    ca.class_child_id,
    cp.text classParentName,
    cc.text classChildName,
    users.userName
  FROM
    class_article ca 
  LEFT JOIN users ON ca.uid=users.uid
  LEFT JOIN class_parent cp ON cp.id=ca.class_parent_id
  LEFT JOIN class_child cc ON cc.id=ca.class_child_id
  WHERE
    ca.id=?`;
  const artilceInfoSql = `SELECT article_id, count(type) count, type FROM article_other GROUP BY article_id,type`; // 统计收藏、点赞数量
  const commentSql = `SELECT count(id) count, article_id FROM class_comments GROUP BY article_id`; // 统计文章评论id
  const viewDataPromise = new Promise((resolve, reject) => {
    db.query(selectSql, id, (err, datas) => {
      if (err) {
        dbError(err, res);
        reject();
        return;
      }
      resolve(mysqlFieldTohump(datas));
    })
  })

  const articleInfoPromise = new Promise((resolve, reject) => {
    db.query(artilceInfoSql, (err, result) => {
      if (err) {
        dbError(err, res);
        reject();
        return;
      }
      resolve(mysqlFieldTohump(result))
    });
  })
  const commentPromise = new Promise((resolve, reject) => {
    db.query(commentSql, (err, result) => {
      if (err) {
        dbError(err, res);
        reject()
        return;
      }
      resolve(mysqlFieldTohump(result))
    });
  })

  const [viewDataList] = await Promise.all<any>([viewDataPromise]);
  const viewData = viewDataList[0];

  if (viewData) {
    const [articleOtherInfoList, commentList] = await Promise.all<any>([articleInfoPromise, commentPromise]);
    viewData.collect = 0;
    viewData.parise = 0;
    viewData.commentCount = 0;

    articleOtherInfoList.map((item: any) => {
      if (item.articleId == viewData.id) {
        viewData[item.type] = item.count;
      }
    })

    for (let i = 0; i < commentList.length; i++) {
      const item = commentList[i];
      if (item.articleId === viewData.id) {
        viewData.commentCount = item.count;
        break;
      }
    }

    resTemplate(codes.success, '查询成功', res, mysqlFieldTohump(viewData));
    return;
  }
  resTemplate(codes.notViewData, codes.notViewDataText, res);
})

/**
* @api {put} /api/article/class/edit
* @apiName 编辑文章
* @apiGroup Article
*
* @apiParam {Number} id 文章id
* @apiParam ....
*/
router.put('/class/edit', async (req, res) => {
  getUserPermissions(req).then(async (tokenData) => {
    const { userInfo } = tokenData;
    const uid = userInfo?.uid ?? '';
    const {
      id,
      title,
      description,
      keywords,
      classParentId,
      classChildId,
      thumbnail,
      content,
      status = 1,
    } = req.body;

    if (checkField(id, res, '文章id')) return;

    // 验证函数是否存在
    const findPromise = new Promise((resolve, reject) => {
      const sql = `SELECT id FROM class_article WHERE id=?`;
      db.query(sql, id, (err, data) => {
        if (err) {
          dbError(err, res);
          return;
        }
        if (data.length) {
          resolve(true);
        } else {
          reject('文章不存在')
        }
      })
    })

    // 修改函数
    const updatePromise = new Promise((resolve, reject) => {
      const sql = `
        UPDATE class_article SET 
        title=?, 
        description=?,
        keywords=?,
        class_parent_id=?,
        class_child_id=?,
        thumbnail=?,
        content=?,
        status=?,
        update_uid=?,
        update_time=?
      WHERE id=?`;
      const values = [
        title,
        description,
        keywords,
        classParentId,
        classChildId,
        thumbnail,
        content,
        status,
        uid,
        new Date(),
        id,
      ];

      db.query(sql, values, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        if (result.affectedRows) {
          // 缩略图处理
          // if (thumbnail) {
          //   let lastIndex = thumbnail.lastIndexOf('/');
          //   let thumbnailName = thumbnail.slice(lastIndex + 1);
          //   const filePath = moveFile(lastIndex > -1 ? thumbnailName : thumbnail); // 移动缩略图
          //   db.query('UPDATE class_article SET thumbnail=? WHERE id=?', [filePath, id]);
          // }

          resolve('修改成功');
        } else {
          reject('修改失败')
        }
      })
    })

    await Promise.all([findPromise, updatePromise]).then(() => {
      resTemplate(codes.success, '修改成功', res);
    }).catch(err => {
      resTemplate(codes.error, JSON.stringify(err), res);
    })
  }).catch(error => {
    resTemplate(error.code, error.message, res);
  })
});


/**
 * @api {delete} /api/article/class/delete
 * @apiName 删除文章
 * @apiGroup Article
 *
 * @apiParam {Number} id 文章id
 */
router.delete('/class/delete', (req, res) => {
  getUserPermissions(req).then(() => {
    const { id } = req.body;
    const deleteSql = `DELETE FROM class_article WHERE id=?`;
    const deleteCommentSql = `DELETE FROM class_comments WHERE article_id=?`;

    if (checkField(id, res, '文章id')) return;
    db.query(deleteSql, id, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.affectedRows) {
        // 删除成功后，把相关联的评论也删除了
        db.query(deleteCommentSql, id, (err, result) => {
          if (err) {
            dbError(err, res);
            return;
          }
          if (result.affectedRows) {
            resTemplate(codes.success, '删除成功', res);
            return;
          }
          resTemplate(codes.success, '删除成功!但删除关联的评论时失败了～', res);
        })
        return;
      }
      resTemplate(codes.error, '删除失败', res);
    })
  }).catch(error => {
    resTemplate(error.code, error.message, res);
  })
});

/**
 * @api {get} /api/article/prevAndNextArticle
 * @apiName 上一篇文章和下一篇文章的信息
 * @apiGroup Article
 * 
 * @apiParam {Number} id
 */
router.get('/prevAndNextArticle', async (req, res) => {
  const { id } = req.query as any;
  const resultMap = {
    prevArticle: null,
    nextArticle: null,
  }
  if (checkField(id, res, '文章id')) return;

  const prevPromise = new Promise((resolve, reject) => {
    const select = `
    SELECT
      cp.text classParentName,
      cc.text classChildName,
      article.* 
    FROM
      class_article article
      LEFT JOIN class_parent cp ON article.class_parent_id = cp.id
      LEFT JOIN class_child cc ON article.class_child_id = cc.id 
    WHERE
      article.id < ?
      AND article.status=1
    ORDER BY
      id DESC 
      LIMIT 0,1
    `;
    db.query(select, id, (err, data) => {
      if (err) {
        reject(err);
        dbError(err, res);
        return;
      }
      resultMap.prevArticle = mysqlFieldTohump(data[0]) || null;
      resolve(true);
    })
  })

  const nextPromise = new Promise((resolve, reject) => {
    const select = `
    SELECT
      cp.text classParentName,
      cc.text classChildName,
      article.* 
    FROM
      class_article article
      LEFT JOIN class_parent cp ON article.class_parent_id = cp.id
      LEFT JOIN class_child cc ON article.class_child_id = cc.id 
    WHERE
      article.id > ?
      AND article.status=1
    ORDER BY id 
      LIMIT 0,1
    `;
    db.query(select, id, (err, data) => {
      if (err) {
        reject(err);
        dbError(err, res);
        return;
      }
      resultMap.nextArticle = mysqlFieldTohump(data[0]) || null;
      resolve(true);
    })
  })

  await Promise.all([prevPromise, nextPromise]).then(() => {
    resTemplate(codes.success, '查询成功', res, resultMap);
  })
})

/**
 * @api {post} /api/article/update/browse
 * @apiName 修改文章浏览量
 * @apiGroup Article
 * 
 * @apiParam {Number} id 文章ID
 */
router.post('/update/browse', (req, res) => {
  const { id } = req.body;
  const updateSql = `UPDATE class_article SET browse_number=browse_number+1 WHERE id=?`;

  if (checkField(id, res, '文章ID')) return;
  db.query(updateSql, id, (err, result) => {
    if (err) {
      dbError(err, res);
      return;
    }
    if (result.affectedRows) {
      resTemplate(codes.success, '浏览量设置成功', res);
      return;
    }
    resTemplate(codes.updateError, '浏览量设置失败', res);
  })
})

/**
 * @api {post} /api/article/collect/list
 * @apiName 收藏列表
 * @apiGroup Article
 * 
 * @apiParam {Number} current 当前页
 * @apiParam {Number} pageSize 分页大小
 */
router.post('/collect/list', async (req, res) => {
  getUserPermissions(req, false).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid ?? 0;
    const { current = 1, pageSize = 20 } = req.body;
    const resultMap = {
      total: 0,
      current,
      pageSize,
      data: []
    }

    // 总数据量
    const totalPromise = new Promise((resolve, reject) => {
      const select = `
        SELECT
          COUNT(id) AS collectCount
        FROM
          article_other other 
        WHERE
          other.uid = ?
          AND other.type = 'collect' 
        ORDER BY
          other.create_time DESC
      `;
      db.query(select, [uid], (err, result) => {
        if (err) {
          dbError(err, res);
          reject(err);
          return;
        }

        const first = result[0];
        resultMap.total = first.collectCount || 0;
        resolve(true);
      });
    });

    const dataPromise = new Promise((resolve, reject) => {
      const select = `
        SELECT
          other.create_time,
          userName,
          ca.title,
          ca.id
        FROM
          article_other other
        LEFT JOIN users ON other.uid = users.uid
        LEFT JOIN class_article ca ON other.article_id = ca.id 
        WHERE
          other.uid = ?
          AND other.type = 'collect' 
        ORDER BY
          other.create_time DESC
        LIMIT ${(current - 1) * pageSize}, ${pageSize}
      `;
      db.query(select, [uid], (err, data) => {
        if (err) {
          dbError(err, res);
          reject(err);
          return;
        }

        resultMap.data = mysqlFieldTohump(data);
        resolve(true);
      })
    })

    Promise.all([totalPromise, dataPromise]).then(() => {
      resTemplate(codes.success, '查询成功', res, resultMap);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})



export default router;

