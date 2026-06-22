import { Sequelize, DataTypes, Model, Optional, ModelStatic } from 'sequelize';
import { env } from '../config';
import { DEFAULT_AVATAR } from '../utils/defaultAvatars';

export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'mysql',
  logging: env.isDev ? console.log : false,
  timezone: '+08:00',
  define: {
    timestamps: false,
    freezeTableName: true,
  },
});

// ─── Users ───────────────────────────────────────────────────────────────────
export interface UserAttrs {
  id: number;
  uid: string;
  userName: string;
  phone: string;
  password: string;
  gender?: number;
  createTime?: Date;
  email?: string;
  roleName?: string;
  face?: string;
  roleCode?: number;
  status?: number;
}
export type UserCreation = Optional<UserAttrs, 'id'>;
export class User extends Model<UserAttrs, UserCreation> implements UserAttrs {
  declare id: number;
  declare uid: string;
  declare userName: string;
  declare phone: string;
  declare password: string;
  declare gender: number;
  declare createTime: Date;
  declare email: string;
  declare roleName: string;
  declare face: string;
  declare roleCode: number;
  declare status: number;
}
User.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  uid: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  userName: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  phone: { type: DataTypes.STRING(11), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(100), allowNull: false },
  gender: { type: DataTypes.SMALLINT, defaultValue: 0 },
  createTime: DataTypes.DATE,
  email: { type: DataTypes.STRING(255), unique: true },
  roleName: { type: DataTypes.STRING(255), defaultValue: '普通会员' },
  face: DataTypes.STRING(10000),
  roleCode: { type: DataTypes.SMALLINT, defaultValue: 0 },
  status: { type: DataTypes.SMALLINT, defaultValue: 1 },
}, { sequelize, tableName: 'users' });

// ─── ClassArticle ────────────────────────────────────────────────────────────
export class ClassArticle extends Model {
  declare id: number;
  declare title: string;
  declare description: string;
  declare keywords: string;
  declare create_time: Date;
  declare uid: string;
  declare update_time: Date;
  declare update_uid: string;
  declare class_parent_id: number;
  declare class_child_id: number;
  declare content: string;
  declare thumbnail: string;
  declare status: number;
  declare browse_number: number;
}
ClassArticle.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(128), allowNull: false },
  description: DataTypes.STRING(128),
  keywords: DataTypes.STRING(255),
  create_time: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  uid: { type: DataTypes.STRING(255), allowNull: false },
  update_time: DataTypes.DATE,
  update_uid: DataTypes.STRING(255),
  class_parent_id: { type: DataTypes.INTEGER, allowNull: false },
  class_child_id: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  thumbnail: DataTypes.STRING(255),
  status: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  browse_number: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, tableName: 'class_article' });

// ─── ClassParent ─────────────────────────────────────────────────────────────
export class ClassParent extends Model {
  declare id: number;
  declare text: string;
  declare create_uid: string;
  declare create_time: Date;
  declare update_time: Date;
  declare update_uid: string;
}
ClassParent.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  text: { type: DataTypes.STRING(128), allowNull: false, unique: true },
  create_uid: { type: DataTypes.STRING(255), allowNull: false },
  create_time: { type: DataTypes.DATE, allowNull: false },
  update_time: DataTypes.DATE,
  update_uid: DataTypes.STRING(255),
}, { sequelize, tableName: 'class_parent' });

// ─── ClassChild ──────────────────────────────────────────────────────────────
export class ClassChild extends Model {
  declare id: number;
  declare text: string;
  declare class_parent_id: number;
  declare create_uid: string;
  declare create_time: Date;
  declare update_time: Date;
  declare update_uid: string;
}
ClassChild.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  text: { type: DataTypes.STRING(128), allowNull: false, unique: true },
  class_parent_id: { type: DataTypes.INTEGER, allowNull: false },
  create_uid: { type: DataTypes.STRING(255), allowNull: false },
  create_time: { type: DataTypes.DATE, allowNull: false },
  update_time: DataTypes.DATE,
  update_uid: DataTypes.STRING(255),
}, {
  sequelize,
  tableName: 'class_child',
  indexes: [{ fields: ['class_parent_id'] }],
});

// ─── ClassComments ───────────────────────────────────────────────────────────
export class ClassComments extends Model {
  declare id: number;
  declare uid: string;
  declare content: string;
  declare create_time: Date;
  declare article_id: number;
  declare level: number;
  declare thread: string;
  declare correlate_id: string;
}
ClassComments.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  uid: { type: DataTypes.STRING(255), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  create_time: { type: DataTypes.DATE, allowNull: false },
  article_id: { type: DataTypes.INTEGER, allowNull: false },
  level: { type: DataTypes.TINYINT, defaultValue: 1 },
  thread: { type: DataTypes.STRING(255), defaultValue: '/' },
  correlate_id: DataTypes.STRING(255),
}, { sequelize, tableName: 'class_comments' });

// ─── ArticleOther ────────────────────────────────────────────────────────────
export class ArticleOther extends Model {
  declare id: number;
  declare uid: string;
  declare type: string;
  declare article_id: number;
  declare create_time: Date;
  declare business_code: number;
}
ArticleOther.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  uid: { type: DataTypes.STRING(255), allowNull: false },
  type: { type: DataTypes.STRING(255), allowNull: false },
  article_id: { type: DataTypes.INTEGER, allowNull: false },
  create_time: { type: DataTypes.DATE, allowNull: false },
  business_code: { type: DataTypes.SMALLINT, defaultValue: 1 },
}, { sequelize, tableName: 'article_other' });

// ─── Banners ─────────────────────────────────────────────────────────────────
export class Banner extends Model {
  declare id: number;
  declare banner_id: number;
  declare name: string;
  declare href: string;
  declare img: string;
  declare window_desc: string;
  declare describe: string;
  declare create_time: Date;
  declare uid: string;
  declare update_time: Date;
  declare update_uid: string;
  declare status: number;
}
Banner.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  banner_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  href: { type: DataTypes.STRING(1000), allowNull: false },
  img: { type: DataTypes.STRING(255), allowNull: false },
  window_desc: DataTypes.STRING(255),
  describe: DataTypes.STRING(255),
  create_time: DataTypes.DATE,
  uid: { type: DataTypes.STRING(255), allowNull: false },
  update_time: DataTypes.DATE,
  update_uid: DataTypes.STRING(255),
  status: { type: DataTypes.SMALLINT, defaultValue: 1 },
}, { sequelize, tableName: 'banners' });

// ─── Blogroll ────────────────────────────────────────────────────────────────
export class Blogroll extends Model {
  declare id: number;
  declare webName: string;
  declare link: string;
  declare describe: string;
  declare uid: string;
  declare createTime: Date;
  declare status: number;
  declare orderNum: number;
  declare reason: string;
}
Blogroll.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  webName: { type: DataTypes.STRING(20), allowNull: false },
  link: { type: DataTypes.STRING(255), allowNull: false },
  describe: { type: DataTypes.STRING(200), allowNull: false },
  uid: { type: DataTypes.STRING(255), allowNull: false },
  createTime: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
  orderNum: { type: DataTypes.INTEGER, defaultValue: 0 },
  reason: DataTypes.STRING(2000),
}, { sequelize, tableName: 'blogroll' });

// ─── Course ──────────────────────────────────────────────────────────────────
export class Course extends Model {
  declare id: number;
  declare course_name: string;
  declare status: number;
  declare create_time: Date;
  declare update_time: Date;
  declare uid: string;
  declare keyword: string;
  declare describe: string;
  declare update_uid: string;
  declare thumbnail: string;
  declare course_type: number;
  declare price: number;
  declare discounts_price: number;
  declare class_id: number;
  declare sort: number;
  declare brower_number: number;
}
Course.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  course_name: { type: DataTypes.STRING(128), allowNull: false },
  status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
  create_time: { type: DataTypes.DATE, allowNull: false },
  update_time: DataTypes.DATE,
  uid: { type: DataTypes.STRING(255), allowNull: false },
  keyword: DataTypes.STRING(255),
  describe: DataTypes.STRING(255),
  update_uid: DataTypes.STRING(255),
  thumbnail: DataTypes.STRING(255),
  course_type: DataTypes.SMALLINT,
  price: DataTypes.DECIMAL(11, 2),
  discounts_price: DataTypes.DECIMAL(10, 2),
  class_id: { type: DataTypes.INTEGER, allowNull: false },
  sort: DataTypes.SMALLINT.UNSIGNED,
  brower_number: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, tableName: 'course' });

// ─── CourseChapter ───────────────────────────────────────────────────────────
export class CourseChapter extends Model {
  declare id: number;
  declare chapter_name: string;
  declare status: number;
  declare create_time: Date;
  declare update_time: Date;
  declare uid: string;
  declare keyword: string;
  declare describe: string;
  declare course_id: number;
  declare update_uid: string;
  declare sort: number;
  declare brower_number: number;
  declare content: string;
  declare show_header: number;
  declare len: number;
  declare header_content: string;
}
CourseChapter.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  chapter_name: { type: DataTypes.STRING(128), allowNull: false },
  status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
  create_time: { type: DataTypes.DATE, allowNull: false },
  update_time: DataTypes.DATE,
  uid: { type: DataTypes.STRING(255), allowNull: false },
  keyword: DataTypes.STRING(255),
  describe: DataTypes.STRING(255),
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  update_uid: DataTypes.STRING(255),
  sort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  brower_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  content: DataTypes.TEXT,
  show_header: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
  len: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  header_content: DataTypes.TEXT,
}, { sequelize, tableName: 'course_chapter' });

// ─── CourseChapterComments ───────────────────────────────────────────────────
export class CourseChapterComments extends Model {
  declare id: number;
  declare uid: string;
  declare content: string;
  declare create_time: Date;
  declare chapter_id: number;
  declare level: number;
  declare thread: string;
  declare correlate_id: string;
}
CourseChapterComments.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  uid: { type: DataTypes.STRING(255), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  create_time: { type: DataTypes.DATE, allowNull: false },
  chapter_id: { type: DataTypes.INTEGER, allowNull: false },
  level: { type: DataTypes.TINYINT, defaultValue: 1 },
  thread: { type: DataTypes.STRING(255), defaultValue: '/' },
  correlate_id: DataTypes.STRING(255),
}, { sequelize, tableName: 'course_chapter_comments' });

// ─── QuestionBank ────────────────────────────────────────────────────────────
export class QuestionBank extends Model {
  declare id: number;
  declare class_id: number;
  declare language_id: number;
  declare issue: string;
  declare answer: string;
  declare uid: string;
  declare audit_uid: string;
  declare create_time: Date;
  declare audit_time: Date;
  declare status: number;
  declare audit_reason: string;
}
QuestionBank.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  class_id: { type: DataTypes.INTEGER, allowNull: false },
  language_id: { type: DataTypes.INTEGER, allowNull: false },
  issue: { type: DataTypes.STRING(255), allowNull: false },
  answer: { type: DataTypes.TEXT, allowNull: false },
  uid: { type: DataTypes.STRING(255), allowNull: false },
  audit_uid: DataTypes.STRING(255),
  create_time: { type: DataTypes.DATE, allowNull: false },
  audit_time: DataTypes.DATE,
  status: { type: DataTypes.SMALLINT, defaultValue: 0 },
  audit_reason: DataTypes.STRING(1000),
}, { sequelize, tableName: 'question_bank' });

// ─── QuestionBankClass ─────────────────────────────────────────────────────
export class QuestionBankClass extends Model {
  declare id: number;
  declare label: string;
  declare create_time: Date;
  declare status: number;
  declare uid: string;
  declare audit_uid: string;
  declare audit_time: Date;
  declare audit_reason: string;
}
QuestionBankClass.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  label: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  create_time: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
  uid: { type: DataTypes.STRING(255), allowNull: false },
  audit_uid: DataTypes.STRING(255),
  audit_time: DataTypes.DATE,
  audit_reason: DataTypes.STRING(1000),
}, { sequelize, tableName: 'question_bank_class' });

// ─── QuestionBankLanguage ────────────────────────────────────────────────────
export class QuestionBankLanguage extends Model {
  declare id: number;
  declare label: string;
  declare class_id: number;
  declare create_time: Date;
  declare status: number;
  declare audit_reason: string;
  declare audit_uid: string;
  declare audit_time: Date;
  declare uid: string;
}
QuestionBankLanguage.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  label: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  class_id: { type: DataTypes.INTEGER, allowNull: false },
  create_time: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.SMALLINT, defaultValue: 0 },
  audit_reason: DataTypes.STRING(1000),
  audit_uid: DataTypes.STRING(255),
  audit_time: DataTypes.DATE,
  uid: { type: DataTypes.STRING(255), allowNull: false },
}, { sequelize, tableName: 'question_bank_language' });

// ─── SystemLog ───────────────────────────────────────────────────────────────
export class SystemLog extends Model {
  declare id: number;
  declare title: string;
  declare request_method: string;
  declare request_path: string;
  declare ip: string;
  declare request_params: string;
  declare create_time: Date;
  declare uid: string;
  declare userName: string;
  declare content: string;
  declare api_name: string;
  declare code: number;
}
SystemLog.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  request_method: DataTypes.STRING(255),
  request_path: DataTypes.STRING(255),
  ip: DataTypes.STRING(255),
  request_params: DataTypes.TEXT,
  create_time: DataTypes.DATE,
  uid: DataTypes.STRING(255),
  userName: DataTypes.STRING(255),
  content: DataTypes.STRING(255),
  api_name: { type: DataTypes.STRING(255), allowNull: false },
  code: { type: DataTypes.INTEGER, defaultValue: 200 },
}, { sequelize, tableName: 'system_log' });

// ─── SmsCode（短信验证码，每次发送一条记录，10 分钟内有效） ─────────────────
export class SmsCode extends Model {
  declare id: number;
  declare phone: string;
  declare code: string;
  declare create_time: Date;
}
SmsCode.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  phone: { type: DataTypes.STRING(11), allowNull: false },
  code: { type: DataTypes.STRING(6), allowNull: false },
  create_time: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  tableName: 'sms_code',
  indexes: [{ fields: ['phone'] }],
});

// ─── Associations（constraints: false 与旧库一致，sync 时不创建外键） ────────
ClassChild.belongsTo(ClassParent, { foreignKey: 'class_parent_id', as: 'parent', constraints: false });
ClassParent.hasMany(ClassChild, { foreignKey: 'class_parent_id', as: 'children', constraints: false });
ClassArticle.belongsTo(ClassParent, { foreignKey: 'class_parent_id', as: 'classParent', constraints: false });
ClassArticle.belongsTo(ClassChild, { foreignKey: 'class_child_id', as: 'classChild', constraints: false });
ClassArticle.belongsTo(User, { foreignKey: 'uid', targetKey: 'uid', as: 'author', constraints: false });
CourseChapter.belongsTo(Course, { foreignKey: 'course_id', as: 'course', constraints: false });
Course.hasMany(CourseChapter, { foreignKey: 'course_id', as: 'chapters', constraints: false });
QuestionBankLanguage.belongsTo(QuestionBankClass, { foreignKey: 'class_id', as: 'qbClass', constraints: false });

/** 所有 Sequelize 模型（用于启动时按需建表） */
const ALL_MODELS: Array<{ name: string; model: ModelStatic<Model> }> = [
  { name: 'users', model: User },
  { name: 'class_parent', model: ClassParent },
  { name: 'class_child', model: ClassChild },
  { name: 'class_article', model: ClassArticle },
  { name: 'class_comments', model: ClassComments },
  { name: 'article_other', model: ArticleOther },
  { name: 'banners', model: Banner },
  { name: 'blogroll', model: Blogroll },
  { name: 'course', model: Course },
  { name: 'course_chapter', model: CourseChapter },
  { name: 'course_chapter_comments', model: CourseChapterComments },
  { name: 'question_bank_class', model: QuestionBankClass },
  { name: 'question_bank_language', model: QuestionBankLanguage },
  { name: 'question_bank', model: QuestionBank },
  { name: 'system_log', model: SystemLog },
  { name: 'sms_code', model: SmsCode },
];

function normalizeTableName(table: unknown): string {
  if (typeof table === 'string') return table.toLowerCase();
  const row = table as { tableName?: string; TABLE_NAME?: string };
  return String(row.tableName || row.TABLE_NAME || table).toLowerCase();
}

/**
 * 检查数据库表，缺失则按 Sequelize 模型自动创建（与 waihu-server 相同策略）
 */
export async function ensureTablesExist(): Promise<void> {
  const qi = sequelize.getQueryInterface();
  const raw = await qi.showAllTables();
  const existing = new Set((raw as unknown[]).map(normalizeTableName));

  console.log(`[DB] database=${env.db.name} existing_tables=${existing.size}`);

  for (const { name, model } of ALL_MODELS) {
    if (existing.has(name.toLowerCase())) continue;
    try {
      await model.sync({ force: false, alter: false });
      console.log(`[DB] created table: ${name}`);
      existing.add(name.toLowerCase());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[DB] create table failed: ${name}`, message);
      throw err;
    }
  }
}

/** 已有用户无头像时回填默认头像 */
async function ensureDefaultUserFaces(): Promise<void> {
  const [result] = await sequelize.query(
    'UPDATE users SET face = ? WHERE face IS NULL OR TRIM(face) = ?',
    { replacements: [DEFAULT_AVATAR, ''] },
  );
  const affected = (result as { affectedRows?: number }).affectedRows ?? 0;
  if (affected > 0) {
    console.log(`[DB] backfilled default avatar for ${affected} user(s)`);
  }
}

export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
  console.log('MySQL connected via Sequelize');

  if (env.dbAutoSync) {
    await ensureTablesExist();
    await ensureSmsCodeTable();
    console.log('[DB] tables ensured');
  }

  await ensureDefaultUserFaces();
}

/** sms_code 旧表以 phone 为主键，需迁移为自增 id */
async function ensureSmsCodeTable(): Promise<void> {
  const qi = sequelize.getQueryInterface();
  const raw = await qi.showAllTables();
  const existing = new Set((raw as unknown[]).map(normalizeTableName));

  if (!existing.has('sms_code')) {
    await SmsCode.sync({ force: false });
    console.log('[DB] created table: sms_code');
    return;
  }

  const desc = await qi.describeTable('sms_code');
  if (!('id' in desc)) {
    console.log('[DB] migrating sms_code table schema');
    await qi.dropTable('sms_code');
    await SmsCode.sync({ force: false });
    console.log('[DB] recreated table: sms_code');
  }
}
