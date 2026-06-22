import express from 'express'
const router = express.Router();
import { resTemplate, checkField, dbError, codes, setCondition, setSorter } from '../../utils';
import { setLog } from '../../utils/business';
import db from '../../utils/db';
import { getUserPermissions } from '../../utils/business';
import { ChapterRule } from '../../types/course';
import { moveFile, mysqlFieldTohump } from '../../utils/function';
import { removeUploadedFile } from '../../utils/storage';

/**
 * 教程接口
 */


/**
 * @api {post} /api/course/add
 * @apiName 新增教程
 * @apiGroup Course
 * 
 * @apiParam {String} courseName 教程名称
 * @apiParam {String} describe 教程描述
 * @apiParam {String} keyword 教程关键字
 * @apiParam {Number} status 状态
 * @apiParam {Number} courseType 教程类型
 * @apiParam {Number} price 售价
 * @apiParam {Number} discountsPrice 优惠价
 * @apiParam {String} thumbnail 缩略图
 * @apiParam {Number} classId 分类ID 
 * @apiParam {Array Object} chapterList 章节列表
 */
router.post('/add', async (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const {
      courseName,
      describe,
      keyword,
      status = 1,
      courseType,
      thumbnail,
      price,
      discountsPrice,
      chapterList,
      classId
    } = req.body;
    const addSql = `INSERT INTO course 
        ( course_name, course.describe, keyword, create_time, status, uid, course_type, thumbnail, price, discounts_price, class_id ) 
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    if (checkField(courseName, res, '教程名称')) return;
    if (checkField(describe, res, '教程描述')) return;
    if (checkField(keyword, res, '教程关键字')) return;
    if (checkField(classId, res, '教程分类')) return;

    db.query(addSql, [
      courseName, describe, keyword, new Date(), status, userInfo?.uid ?? 0, courseType, thumbnail, price, discountsPrice, classId
    ], (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }

      if (result.insertId) {

        // 缩略图处理：传完整路径；已在 /images/ 下则不再从 temp 搬运
        if (thumbnail) {
          moveFile(thumbnail).then((filePath) => {
            db.query('UPDATE course SET thumbnail=? WHERE id=?', [filePath, result.insertId]);
          }).catch((err) => {
            console.error('教程缩略图处理失败', err);
          });
        }

        // 有章节的时候, 添加章节
        if (chapterList) {
          const addChapterSql = 'INSERT INTO course_chapter ( chapter_name, `status`, create_time, uid, keyword, `describe`, course_id ) VALUES ?';
          const newChapterList: any[] = []

          chapterList.map((item: ChapterRule) => {
            newChapterList.push([
              item.chapterName,
              item.status,
              new Date(),
              userInfo?.uid ?? 0,
              item.keyword,
              item.describe,
              result.insertId
            ])
          })

          db.query(addChapterSql, [newChapterList], (err, result) => {
            if (err) {
              dbError({ sqlMessage: '教程已添加，但添加章节失败了; 失败原因：' + err.sqlMessage }, res);
              return;
            }

            if (result.affectedRows > 0) {
              setLog(req, { title: '教程模块', apiName: '新增教程', content: `添加了教程：${courseName} 并在该教程下添加了${newChapterList.length ?? 0}个章节` });
              resTemplate(codes.success, '添加成功', res);
              return;
            }
            setLog(req, { title: '教程模块', apiName: '新增教程', code: codes.error, content: `添加了教程：${courseName} 并在该教程下添加了${newChapterList.length ?? 0}个章节` });
            resTemplate(codes.success, `添加教程成功了，但添加教程章节失败了`, res);
          })
          return;
        }


        setLog(req, { title: '教程模块', apiName: '新增教程', content: `教程名称：${courseName}` });
        resTemplate(codes.success, '添加成功', res);
        return;
      }
      setLog(req, { title: '教程模块', apiName: '新增教程', code: codes.error, content: `教程名称：${courseName}` });
      resTemplate(codes.error, '添加失败', res);
    })
  }).catch(error => {
    resTemplate(error.code, error.message, res);
  })
})

/**
 * @api {post} /api/course/list
 * @apiName 教程列表
 * @apiGroup Course
 * 
 * @apiParam {Number} current 当前分页
 * @apiParam {Number} pageSize 大小
 * @apiParam {Object} sorter 排序字段
 * @apiParam {String} courseName 
 * @apiParam {Number} status 
 */
router.post('/list', (req, res) => {
  const {
    current = 1,
    pageSize = 20,
    sorter = {},
    status,
    courseName,
    classId
  } = req.body;
  let condition = setCondition([
    { fieldName: 'course.status', value: status },
    { fieldName: 'course.class_id', value: classId },
    { fieldName: 'course.course_name', value: courseName, fuzzy: true },
  ]);

  const selectSql = `SELECT
      course.id,
      course.status,
      course.create_time,
      course.update_time,
      course.course_name,
      course.keyword,
      course.describe,
      course.thumbnail,
      course.course_type,
      course.price,
      course.discounts_price,
      users.userName,
      course.class_id,
      course.sort,
      COUNT( course_chapter.id ) chapterCount,
      SUM(course_chapter.len) len
    FROM
      course
    LEFT JOIN users ON course.uid = users.uid
    LEFT JOIN course_chapter ON course.id = course_chapter.course_id 
    ${condition}
    GROUP BY
      course.id
    ${setSorter(sorter, 'course')}
    LIMIT ${(current - 1) * pageSize}, ${pageSize}
  `;
  const totalSql = `SELECT COUNT(id) total FROM course ${condition}`;
  let total = 0;

  db.query(totalSql, (err, result) => {
    if (err) {
      dbError(err, res);
      return;
    }
    total = result[0].total;
  })

  db.query(selectSql, (err: null|object, result: any[]) => {
    if (err) {
      dbError(err, res);
      return;
    }

    let browerCounts = `SELECT course_id courseId, SUM(brower_number) browerNumber FROM course_chapter GROUP BY course_id`;
    db.query(browerCounts, (err: null|object, chapterData: { courseId: number; browerNumber: number}[]) => {
      if (err) {
        console.log('查询教程浏览量错误', err)
        return;
      }

      result.map((item) => {
        let chapterItem = chapterData.find(c => c.courseId === item.id);
        if (chapterItem) {
          item.browerNumber = chapterItem.browerNumber || 0;
        }
      })


      resTemplate(codes.success, '查询成功', res, {
        current,
        pageSize,
        total,
        dataSource: mysqlFieldTohump(result),
      })
    })

  })
})


/**
 * @api {put} /api/course/update
 * @apiName 编辑教程
 * @apiGroup Course
 * 
 * @apiParam {String} courseName 教程名称
 * @apiParam {Number} status 状态
 * @apiParam {String} keyword 关键词
 * @apiParam {String} describe 描述
 * @apiParam {Number} id 教程id
 * @apiParam {String} thumbnail 缩略图地址
 */
router.put('/update', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const { courseName, describe, keyword, status = 1, id, thumbnail, sort } = req.body;
    const updateSql = `
      UPDATE course 
      SET course_name = ?,
      course.status =?,
      update_time =?,
      keyword =?,
      course.describe =?,
      thumbnail = ?,
      update_uid =?,
      sort=?
      WHERE
        id = ?;
    `;
    const selectSql = `SELECT course_name, id, thumbnail FROM course WHERE id = ?`;
    let historyCourse: { courseName?: string; id?: number; thumbnail?: string | null } = {};

    if (checkField(courseName, res, '教程名称')) return;
    if (checkField(describe, res, '教程描述')) return;
    if (checkField(keyword, res, '教程关键字')) return;
    if (checkField(id, res, '教程ID')) return;

    db.query(selectSql, id, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }

      if (data.length === 0) {
        resTemplate(codes.error, '未找到该教程', res);
        return;
      }

      historyCourse = mysqlFieldTohump(data[0]);
    })

    const values = [
      courseName,
      status,
      new Date(),
      keyword,
      describe,
      thumbnail,
      userInfo?.uid ?? 0,
      sort,
      id
    ]
    db.query(updateSql, values, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      const content = `修改了教程，原教程名称：${historyCourse.courseName ?? '-'} 教程id: ${historyCourse.id}`;
      if (result.affectedRows) {
        // 缩略图处理：传完整路径；已在 /images/ 下则不再从 temp 搬运
        if (thumbnail) {
          moveFile(thumbnail).then((filePath) => {
            db.query('UPDATE course SET thumbnail=? WHERE id=?', [filePath, id]);
            if (historyCourse.thumbnail && historyCourse.thumbnail !== filePath) {
              removeUploadedFile(historyCourse.thumbnail).catch(() => {});
            }
          }).catch((err) => {
            console.error('教程缩略图处理失败', err);
          });
        }

        setLog(req, { title: '教程模块', apiName: '编辑教程', content });
        resTemplate(codes.success, '修改成功', res);
        return;
      }
      setLog(req, { title: '教程模块', apiName: '编辑教程', code: codes.error, content });
      resTemplate(codes.error, '修改失败', res);
    })
  }).catch(error => {
    resTemplate(error.code, error.message, res);
  })
})


/**
 * @api {delete} /api/course/delete
 * @apiName 删除教程
 * @apiGroup Course
 * 
 * @apiParam {Number} id 教程id
 */
router.delete('/delete', async (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const { id } = req.body;
    const deleteSql = `DELETE FROM course WHERE id = ?`;
    const selectSql = `SELECT course_name FROM course WHERE id = ? `;
    let courseInfo: { courseName?: string } = {}

    if (checkField(id, res, '教程ID')) return;

    db.query(selectSql, id, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }

      if (data.length === 0) {
        resTemplate(codes.error, '教程ID不存在', res);
        return;
      }
      courseInfo = mysqlFieldTohump(data[0]);
    })

    if (!courseInfo) return;

    db.query(deleteSql, id, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }

      if (result.affectedRows) {
        setLog(req, { title: '教程模块', apiName: '删除教程', content: `删除了教程: ${courseInfo.courseName}` });
        resTemplate(codes.success, '删除成功', res);
        return;
      }
      setLog(req, { title: '教程模块', apiName: '删除教程', code: codes.error, content: `删除了教程: ${courseInfo.courseName}` });
      resTemplate(codes.error, '删除失败', res);
    })

  }).catch(error => {
    resTemplate(error.code, error.message, res);
  })
})


/**
 * @api {get} /api/course/view/{id}
 * @apiName 查询教程详情
 * @apiGroup Course
 * 
 * @apiParam {Number} id 教程id
 */
router.get('/view/:id', (req, res) => {
  const { id } = req.params;
  const selectCourceSql = `
    SELECT
      course.id,
      course.status,
      course.create_time,
      course.update_time,
      course.course_name,
      course.keyword,
      course.describe,
      course.thumbnail,
      course.course_type,
      course.price,
      course.discounts_price,
      course.class_id,
      course.brower_number bn,
      course.sort,
      users.userName,
      users.id userId,
      u1.userName updateName,
      cp.text classParentType,
      COUNT( course_chapter.id ) chapterCount,
      SUM( course_chapter.len ) len,
      SUM( course_chapter.brower_number ) browerNumber 
    FROM
      course
      LEFT JOIN users ON course.uid = users.uid
      LEFT JOIN users u1 ON course.update_uid = u1.uid 
      LEFT JOIN class_parent cp ON course.class_id = cp.id
      LEFT JOIN course_chapter ON course.id = course_chapter.course_id 
    WHERE
      course.id = ?
    GROUP BY
      course.id
  `;
  const selectChapterSql = `
    SELECT
      chapter.id,
      chapter.chapter_name,
      chapter.create_time,
      chapter.describe,
      chapter.keyword,
      chapter.status,
      chapter.sort,
      users.userName
    FROM
      course_chapter chapter
    LEFT JOIN users ON chapter.uid = users.uid 
    WHERE
      course_id = ?
    ORDER BY sort DESC
  `;
  const commentSql = `SELECT COUNT(chapter_id) count, chapter_id FROM course_chapter_comments GROUP BY chapter_id`; // 统计文章评论数量
  let commentInfo: { count: number; chapterId: number }[] = [];

  if (checkField(id, res, '教程ID')) return;

  db.query(commentSql, id, (err, result) => {
    if (err) {
      dbError(err, res);
      return;
    }

    commentInfo = mysqlFieldTohump(result);
  })

  db.query(selectCourceSql, id, (err, data) => {
    if (err) {
      dbError(err, res);
      return;
    }

    if (!data || data.length === 0) {
      resTemplate(codes.error, '找不到该教程ID', res);
      return;
    }

    let first = data[0];

    db.query(selectChapterSql, id, (err, chapterList) => {
      if (err) {
        dbError(err, res);
        return;
      }
      
      const newChapterList: ChapterRule[] = mysqlFieldTohump(chapterList);
      (newChapterList ?? []).map(item => {
        for (let index = 0; index < (commentInfo?.length ?? 0); index++) {
          let mItem = commentInfo[index];
          if (mItem.chapterId === item.id) {
            item.commentCount = mItem.count;
            break;
          }
        }
      })
      resTemplate(codes.success, '查询成功', res, {
        ...mysqlFieldTohump(first),
        browerNumber: (first.bn || 0) + (first.browerNumber || 0),
        chapterList: chapterList,
      })
    })
  })
})

/**
* @api {post} /api/course/update/browse
* @apiName 修改教程浏览量
* @apiGroup Course
* 
* @apiParam {Number} id 章节ID
*/
router.post('/update/browse', (req, res) => {
  const { id } = req.body;
  const updateSql = `UPDATE course SET brower_number=brower_number+1 WHERE id=?`;

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
