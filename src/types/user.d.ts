export interface UserInfo {
  id: number;
  uid: string;
  userName: string;
  phone: string;
  password: string,
  gender: string,
  createTime: string;
  email: null|string;
  roleName: string;
  face: string|null;
  roleCode: number;
  status: number;
}