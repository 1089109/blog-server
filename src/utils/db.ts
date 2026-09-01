import { QueryTypes } from 'sequelize';
import { sequelize } from '../models';

type QueryCallback = (err: Error | null, result?: unknown) => void;

const db = {
  query(sql: string, ...args: unknown[]): void {
    let params: unknown[] = [];
    let callback: QueryCallback;

    const last = args[args.length - 1];
    if (typeof last === 'function') {
      callback = last as QueryCallback;
      params = args.slice(0, -1);
    } else {
      params = args;
      callback = () => {};
    }

    // 兼容 mysql 风格：db.query(sql, [a, b], cb)
    if (params.length === 1 && Array.isArray(params[0])) {
      params = params[0] as unknown[];
    }

    // Sequelize 占位符不接受 undefined，统一转为 null
    params = params.map((p) => (p === undefined ? null : p));

    const isSelect = /^\s*SELECT/i.test(sql);

    if (isSelect) {
      sequelize
        .query(sql, { replacements: params, type: QueryTypes.SELECT })
        .then((rows) => callback(null, rows))
        .catch((err: Error) => callback(err));
    } else {
      sequelize
        .query(sql, { replacements: params })
        .then((raw: unknown) => {
          let insertId = 0;
          let affectedRows = 0;

          if (Array.isArray(raw)) {
            const tuple = raw as unknown[];
            if (typeof tuple[0] === 'number' && typeof tuple[1] === 'number') {
              insertId = tuple[0];
              affectedRows = tuple[1];
            } else if (tuple[1] && typeof tuple[1] === 'object') {
              const meta = tuple[1] as { insertId?: number; affectedRows?: number };
              insertId = meta.insertId ?? 0;
              affectedRows = meta.affectedRows ?? 0;
            }
          }

          callback(null, { insertId, affectedRows });
        })
        .catch((err: Error) => callback(err));
    }
  },
};

export default db;
