import express from 'express'
const router = express.Router();
import { resTemplate, checkField, dbError, codes, setCondition, setSorter } from '../../utils';
import { setLog } from '../../utils/business';
import db from '../../utils/db';
import { getUserPermissions } from '../../utils/business';
import { ChapterRule } from '../../types/course';
import { mysqlFieldTohump } from '../../utils/function';


/**
 * @api {get} /api/chapter/view/list
 * @apiName 根据教程ID获取章节列表
 * @apiGroup Course
 * 
 * @apiParam {Number} id 教程ID
 */

router.get('/view/list', (req, res) => {
  const { id } = req.query as any;
  const selectSql = `
    SELECT 
      chapter.*,
      users.userName 
    FROM course_chapter chapter 
    LEFT JOIN users ON chapter.uid = users.uid 
    WHERE course_id = ? ORDER BY sort DESC
  `;

  if (checkField(id, res, '教程ID')) return;

  db.query(selectSql, id, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }
    resTemplate(codes.success, '查询成功', res, mysqlFieldTohump(data));
  })
})

/**
 * @api {get} /api/chapter/view/{id}
 * @apiName 章节详情
 * @apiGroup Course
 * 
 * @apiParam {Number} id 章节ID
 */
router.get('/view/:id', (req, res) => {
  const { id } = req.params as any;
  const selectSql = `
    SELECT
      chapter.*,
      course.course_name 
    FROM
      course_chapter chapter
      LEFT JOIN course ON chapter.course_id = course.id 
    WHERE
      chapter.id = ?
  `;
  const commentSql = 'SELECT COUNT(chapter_id) count, chapter_id FROM course_chapter_comments WHERE chapter_id=?';
  let commentCount = 0;

  if (checkField(id, res, '章节ID')) return;

  db.query(commentSql, id, (err, result) => {
    if (err) {
      dbError(err, result);
      return;
    }

    commentCount = result[0]?.count ?? 0;
  })

  db.query(selectSql, id, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }
    const firstData: ChapterRule = mysqlFieldTohump(data[0]);
    if (firstData) {
      setLog(req, {
        apiName: '章节详情',
        title: '教程模块',
        content: `访问了章节：《${firstData.chapterName}》`
      })
      resTemplate(codes.success, '查询成功', res, { ...firstData, commentCount });
      return;
    }

    setLog(req, {
      apiName: '章节详情',
      title: '教程模块',
      content: `访问了章节：但查找不到，章节ID ${id}`,
      code: codes.error,
    })
    resTemplate(codes.error, '查找不到该章节', res, firstData);
  })
})


/**
 * @api {delete} /api/chapter/delete/{id}
 * @apiName 删除章节
 * @apiGroup Course 
 * 
 * @apiParam {Number} id 教程
 */
router.delete('/delete/:id', (req, res) => {
  getUserPermissions(req).then(data => {
    const { id } = req.params;
    const deleteSql = `DELETE FROM course_chapter WHERE id = ?`;
    const selectSql = `SELECT chapter_name FROM course_chapter WHERE id= ? `;
    let chapterInfo: { chapterName: string } | null = null;

    if (checkField(id, res, '章节ID')) return;

    db.query(selectSql, id, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (data.length === 0) {
        resTemplate(codes.error, '找不到章节', res);
        return;
      }
      chapterInfo = mysqlFieldTohump(data[0]);
    })

    db.query(deleteSql, id, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }

      const content = `删除了章节 ${chapterInfo?.chapterName ?? id}`;

      if (result.affectedRows) {
        setLog(req, { title: '教程模块', apiName: '删除章节', content, });
        resTemplate(codes.success, '删除成功', res);
        return;
      }

      setLog(req, { title: '教程模块', apiName: '删除章节', content, code: codes.error });
      resTemplate(codes.success, '删除失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {put} /api/chapter/update/sort
 * @apiName 修改章节排序号
 * @apiGroup Course
 * 
 * @apiParam {Number} id 章节ID
 * @apiParam {Number} sort 章节排序号
 */
router.put('/update/sort', (req, res) => {
  getUserPermissions(req).then(() => {
    const { id, sort } = req.body;
    const selectSql = `SELECT chapter_name FROM course_chapter WHERE id= ? `;
    const updateSql = `UPDATE course_chapter SET sort=? WHERE id=?`;
    let chapterInfo: { chapterName: string } | null = null;

    if (checkField(id, res, '章节ID')) return;
    if (checkField(sort, res, '排序号数字')) return;

    db.query(selectSql, id, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }

      if (data.length === 0) {
        resTemplate(codes.error, '未找到章节', res);
        return;
      }

      chapterInfo = mysqlFieldTohump(data[0]);
    })

    db.query(updateSql, [sort, id], (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      const content = `修改了章节 ${chapterInfo?.chapterName ?? id} 新的章节排序号是：${sort}`;

      if (result.affectedRows) {
        setLog(req, { title: '教程模块', apiName: '修改章节排序号', content, });
        resTemplate(codes.success, '修改成功', res);
        return;
      }

      setLog(req, { title: '教程模块', apiName: '修改章节排序号', content, code: codes.error });
      resTemplate(codes.success, '修改失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/chapter/update
 * @apiName 修改章节
 * @apiGroup Course
 * 
 * @apiParam {Number} id 章节ID
 * @apiParam {String} chapterName 章节名称
 * @apiParam {String} keyword 关键词
 * @apiParam {String} describe 描述
 * @apiParam {Number} showHeader 是否显示索引目录
 * @apiParam {Number} status 
 * @apiParam {Number} sort 排序号
 * @apiParam {Number} len 内容字数
 * 
 */
router.post('/update', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const {
      id,
      chapterName,
      keyword,
      describe,
      showHeader,
      status,
      sort,
      content,
      len = 0,
      headerContent,
    } = req.body;
    const updateSql = `
      UPDATE course_chapter SET
        chapter_name = ?,
        keyword = ?,
        course_chapter.describe = ?,
        show_header = ?,
        course_chapter.status = ?,
        sort = ?,
        content = ?,
        update_time = ?,
        update_uid = ?,
        course_chapter.len = ?,
        course_chapter.header_content = ?
      WHERE id = ?
    `;

    if (checkField(id, res, '章节ID')) return;
    if (checkField(chapterName, res, '章节名称')) return;
    if (checkField(status, res, '状态')) return;
    if (checkField(keyword, res, '关键词')) return;
    if (checkField(describe, res, '描述')) return;
    if (checkField(sort, res, '排序号')) return;
    if (checkField(len, res, '内容字数')) return;
    // if (checkField(content, res, '章节内容')) return;
    const values = [
      chapterName, keyword, describe, showHeader, status,
      sort, content, new Date(), userInfo?.uid ?? '0', len, headerContent, id
    ]
    db.query(updateSql, values, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      let content = `修改了章节信息，章节ID ${id}`

      if (result.affectedRows) {
        setLog(req, {
          apiName: '章节修改',
          title: '教程模块',
          content,
        })
        resTemplate(codes.success, '修改成功', res);
        return;
      }
      setLog(req, {
        apiName: '章节修改',
        title: '教程模块',
        content,
        code: codes.error,
      })
      resTemplate(codes.error, '修改失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/chapter/add
 * @apiName 新增章节
 * @apiGroup Course
 * 
 * @apiParam {Number} id 教程
 * @apiParam {String} chapterName 章节名称
 * @apiParam {String} keyword 关键词
 * @apiParam {String} describe 描述
 * @apiParam {Number} showHeader 是否显示索引目录
 * @apiParam {Number} status 
 * @apiParam {Number} sort 排序号
 * @apiParam {Number} len 字符数量
 */
router.post('/add', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const {
      id,
      chapterName,
      keyword,
      describe,
      showHeader,
      status,
      sort,
      content = '',
      len = 0,
      headerContent,
    } = req.body;
    const insertSql = `
      INSERT INTO course_chapter 
        ( chapter_name, course_chapter.status, create_time, uid, keyword, course_chapter.describe, course_id, sort, content, show_header,len, header_content )
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const selectSql = `SELECT course_name FROM course WHERE id = ?`;
    let courseInfo: { courseName: string } | null = null;

    if (checkField(id, res, '教程ID')) return;
    if (checkField(chapterName, res, '章节名称')) return;
    if (checkField(status, res, '状态')) return;
    if (checkField(keyword, res, '关键词')) return;
    if (checkField(describe, res, '描述')) return;
    if (checkField(sort, res, '排序号')) return;
    // if (checkField(content, res, '章节内容')) return;

    db.query(selectSql, id, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      const firstData = mysqlFieldTohump(data[0]);

      if (!firstData) {
        resTemplate(codes.error, '教程ID不正确', res);
        return;
      }
      courseInfo = firstData;
    })

    const values = [
      chapterName, status, new Date(), userInfo?.uid ?? '0', keyword, describe, id, sort, content, showHeader, len, headerContent,
    ]
    db.query(insertSql, values, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      const content = `在 [${courseInfo?.courseName}] 教程下添加了一个章节：[${chapterName}]`

      if (result.affectedRows) {
        setLog(req, {
          apiName: '新增章节',
          title: '教程模块',
          content,
        })
        resTemplate(codes.success, '新增成功', res);
        return;
      }

      setLog(req, {
        apiName: '新增章节',
        title: '教程模块',
        content,
        code: codes.error
      })
      resTemplate(codes.error, '新增失败', res);
    })

  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/chapter/comment
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

    const insert = `INSERT INTO course_chapter_comments (uid, content, create_time, chapter_id, level, thread, correlate_id) VALUES(?, ?, ?, ?, ?, ?, ?)`;
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

/**
 * @api {get} /api/chapter/comments
 * @apiName 获取章节评论
 * @apiGroup Class
 *
 * @apiParam {String} id 章节Id 
 */
router.get('/comments', (req, res) => {
  const { id } = req.query as any;
  if (checkField(id, res, '章节ID')) return;

  const select = `
    SELECT
    cc.id,
    cc.uid,
    cc.create_time,
    content,
    chapter_id,
    level,
    thread,
    u1.face,
    u1.userName userName,
    u2.userName replyName,
    u1.id userId,
    u2.id replyUserId
  FROM
    course_chapter_comments cc
    LEFT JOIN users u1 ON cc.uid = u1.uid
    LEFT JOIN users u2 ON cc.correlate_id = u2.uid 
  WHERE
    chapter_id = ?
  ORDER BY id
 `;
  db.query(select, id, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }

    resTemplate(200, '查询成功', res, mysqlFieldTohump(data));
  })
})

/**
* @api {post} /api/chapter/update/browse
* @apiName 修改章节浏览量
* @apiGroup Article
* 
* @apiParam {Number} id 章节ID
*/
router.post('/update/browse', (req, res) => {
  const { id } = req.body;
  const updateSql = `UPDATE course_chapter SET brower_number=brower_number+1 WHERE id=?`;

  if (checkField(id, res, '章节ID')) return;
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

export default router;