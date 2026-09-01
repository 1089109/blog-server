import express from 'express';
import { dbError, resTemplate } from '../utils';
import { getUserPermissions } from '../utils/business';
import db from '../utils/db';
import { codes } from '../utils';
import { mysqlFieldTohump } from '../utils/function';

const router = express.Router();

type LogRow = {
  id: number;
  title: string;
  apiName: string;
  requestPath: string;
  requestParams?: string;
  frontPath?: string | null;
};

/** 根据接口路径推导前台可访问路径 */
async function attachFrontPaths(rows: LogRow[]): Promise<LogRow[]> {
  if (!rows.length) return rows;

  const chapterIds = new Set<number>();

  for (const row of rows) {
    const path = row.requestPath || '';
    const m = path.match(/^\/api\/chapter\/view\/(\d+)/);
    if (m) chapterIds.add(Number(m[1]));
  }

  const chapterMap = new Map<number, number>();
  if (chapterIds.size) {
    const ids = [...chapterIds];
    await new Promise<void>((resolve) => {
      db.query(
        `SELECT id, course_id FROM course_chapter WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids,
        (err, data) => {
          if (!err && Array.isArray(data)) {
            for (const item of data as { id: number; course_id: number }[]) {
              chapterMap.set(item.id, item.course_id);
            }
          }
          resolve();
        },
      );
    });
  }

  return rows.map((row) => {
    const path = row.requestPath || '';
    let frontPath: string | null = null;

    let m = path.match(/^\/api\/chapter\/view\/(\d+)/);
    if (m) {
      const chapterId = Number(m[1]);
      const courseId = chapterMap.get(chapterId);
      if (courseId) frontPath = `/course/${courseId}/chapter/${chapterId}`;
    } else if ((m = path.match(/^\/api\/course\/view\/(\d+)/))) {
      frontPath = `/course/${m[1]}`;
    } else if (
      (m = path.match(/^\/api\/article\/(?:detail|view)\/(\d+)/)) ||
      (m = path.match(/^\/api\/class\/article\/(\d+)/))
    ) {
      frontPath = `/class/${m[1]}`;
    } else if (path.includes('/api/questionBand/detail')) {
      try {
        const params = row.requestParams ? JSON.parse(row.requestParams) : {};
        if (params.id) frontPath = `/question-bank/${params.id}`;
      } catch {
        /* ignore */
      }
    } else {
      try {
        const params = row.requestParams ? JSON.parse(row.requestParams) : {};
        const id = Number(params.id || params.articleId);
        if (id && (path.includes('/api/article') || path.includes('/api/class'))) {
          frontPath = `/class/${id}`;
        }
      } catch {
        /* ignore */
      }
    }

    return { ...row, frontPath };
  });
}

/**
 * @api {post} /api/log/list
 * @apiName 日志列表
 * @apiGroup Log
 *
 * @apiParam {Number} current
 * @apiParam {Number} pageSize
 * @apiParam {String} [ip]
 * @apiParam {String} [title]
 * @apiParam {String} [apiName]
 * @apiParam {String} [keyword] 模糊匹配 path/content/userName
 */
router.post('/list', (req, res) => {
  getUserPermissions(req)
    .then(() => {
      const {
        current = 1,
        pageSize = 20,
        ip,
        title,
        apiName,
        keyword,
      } = req.body as {
        current?: number;
        pageSize?: number;
        ip?: string;
        title?: string;
        apiName?: string;
        keyword?: string;
      };

      const where: string[] = [];
      const params: unknown[] = [];

      if (ip) {
        where.push('ip LIKE ?');
        params.push(`%${ip}%`);
      }
      if (title) {
        where.push('title LIKE ?');
        params.push(`%${title}%`);
      }
      if (apiName) {
        where.push('api_name LIKE ?');
        params.push(`%${apiName}%`);
      }
      if (keyword) {
        where.push('(request_path LIKE ? OR content LIKE ? OR userName LIKE ? OR ip LIKE ?)');
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const offset = (Number(current) - 1) * Number(pageSize);
      const selectSql = `SELECT * FROM system_log ${whereSql} ORDER BY create_time DESC LIMIT ${offset}, ${Number(pageSize)}`;
      const totalSql = `SELECT COUNT(id) total FROM system_log ${whereSql}`;

      db.query(totalSql, params, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        const total = result[0]?.total ?? 0;

        db.query(selectSql, params, async (err2, data) => {
          if (err2) {
            dbError(err2, res);
            return;
          }
          const dataSource = await attachFrontPaths(mysqlFieldTohump(data) as LogRow[]);
          resTemplate(codes.success, '查询成功', res, {
            current: Number(current),
            pageSize: Number(pageSize),
            total,
            dataSource,
          });
        });
      });
    })
    .catch((err) => {
      resTemplate(err.code, err.message, res);
    });
});

/**
 * @api {post} /api/log/delete
 * @apiName 删除日志（支持批量）
 * @apiGroup Log
 *
 * @apiParam {Number|Number[]} ids
 */
router.post('/delete', (req, res) => {
  getUserPermissions(req)
    .then(() => {
      const { ids } = req.body as { ids?: number | number[] };
      const idList = (Array.isArray(ids) ? ids : ids != null ? [ids] : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);

      if (!idList.length) {
        resTemplate(codes.error, '请选择要删除的日志', res);
        return;
      }

      const placeholders = idList.map(() => '?').join(',');
      db.query(`DELETE FROM system_log WHERE id IN (${placeholders})`, idList, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        const affected = (result as { affectedRows?: number })?.affectedRows ?? 0;
        resTemplate(codes.success, `已删除 ${affected} 条日志`, res, { affected });
      });
    })
    .catch((err) => {
      resTemplate(err.code, err.message, res);
    });
});

export default router;
