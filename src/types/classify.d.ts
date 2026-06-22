export interface ClassArticleDetail {
  id: number;
  title: string;
  description: string;
  keywords: string;
  create_time: string;
  uid: string;
  update_time: string | null;
  update_uid: string | null;
  class_parent_id: number;
  class_child_id: number;
  content: string;
  thumbnail: string | null;
  status: number;
  browse_number: number;

  // 数据库没有的
  parise?: number;
  collect?: number;
  commentCount?: number;
  browseNumber: number;
  classParentId: number;
  classChildId: number;
  createTime: string;
}