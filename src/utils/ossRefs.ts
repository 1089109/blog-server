import db from './db';

export interface AssetReference {
  type: 'banner' | 'article' | 'course' | 'chapter' | 'user';
  typeLabel: string;
  id: number;
  title: string;
  field: string;
}

const queryRows = <T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve((result as T[]) || []);
    });
  });

const normalizePath = (filePath: string): string => {
  const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
  return path.replace(/\\/g, '/');
};

const fileNameOf = (filePath: string): string => {
  const normalized = normalizePath(filePath);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
};

/** 查询单个资源被哪些业务数据引用 */
export const findAssetReferences = async (filePath: string): Promise<AssetReference[]> => {
  const path = normalizePath(filePath);
  const fileName = fileNameOf(path);
  const refs: AssetReference[] = [];

  const banners = await queryRows<{ id: number; name: string; img: string }>(
    'SELECT id, name, img FROM banners WHERE img = ? OR img LIKE ?',
    [path, `%${fileName}%`]
  );
  banners.forEach((row) => {
    refs.push({
      type: 'banner',
      typeLabel: '广告位',
      id: row.id,
      title: row.name || `广告 #${row.id}`,
      field: 'img',
    });
  });

  const users = await queryRows<{ id: number; userName: string; face: string }>(
    'SELECT id, userName, face FROM users WHERE face = ? OR face LIKE ?',
    [path, `%${fileName}%`]
  );
  users.forEach((row) => {
    refs.push({
      type: 'user',
      typeLabel: '用户头像',
      id: row.id,
      title: row.userName,
      field: 'face',
    });
  });

  const articles = await queryRows<{ id: number; title: string; thumbnail: string | null }>(
    'SELECT id, title, thumbnail FROM class_article WHERE thumbnail = ? OR thumbnail LIKE ?',
    [path, `%${fileName}%`]
  );
  articles.forEach((row) => {
    refs.push({
      type: 'article',
      typeLabel: '文章缩略图',
      id: row.id,
      title: row.title,
      field: 'thumbnail',
    });
  });

  const articleContents = await queryRows<{ id: number; title: string }>(
    'SELECT id, title FROM class_article WHERE content LIKE ?',
    [`%${fileName}%`]
  );
  articleContents.forEach((row) => {
    if (!refs.some((r) => r.type === 'article' && r.id === row.id && r.field === 'content')) {
      refs.push({
        type: 'article',
        typeLabel: '文章内容',
        id: row.id,
        title: row.title,
        field: 'content',
      });
    }
  });

  const courses = await queryRows<{ id: number; course_name: string; thumbnail: string | null }>(
    'SELECT id, course_name, thumbnail FROM course WHERE thumbnail = ? OR thumbnail LIKE ?',
    [path, `%${fileName}%`]
  );
  courses.forEach((row) => {
    refs.push({
      type: 'course',
      typeLabel: '教程缩略图',
      id: row.id,
      title: row.course_name,
      field: 'thumbnail',
    });
  });

  const chapters = await queryRows<{ id: number; chapter_name: string }>(
    'SELECT id, chapter_name FROM course_chapter WHERE content LIKE ?',
    [`%${fileName}%`]
  );
  chapters.forEach((row) => {
    refs.push({
      type: 'chapter',
      typeLabel: '教程章节',
      id: row.id,
      title: row.chapter_name,
      field: 'content',
    });
  });

  return refs;
};
