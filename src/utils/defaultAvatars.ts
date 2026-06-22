/** 系统默认头像（OSS） */
export const DEFAULT_AVATARS = [
  'https://huangcy-blog.oss-cn-guangzhou.aliyuncs.com/system/2026-06-17/2__1781666081659.png',
  'https://huangcy-blog.oss-cn-guangzhou.aliyuncs.com/system/2026-06-17/1__1781666072098.webp',
] as const;

export const DEFAULT_AVATAR = DEFAULT_AVATARS[0];

/** 新注册用户随机分配默认头像 */
export function pickRandomDefaultAvatar(): string {
  const index = Math.floor(Math.random() * DEFAULT_AVATARS.length);
  return DEFAULT_AVATARS[index];
}
