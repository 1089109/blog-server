import { UserInfo } from "./user";


export interface APICheckTokenResult extends UserInfo {
  userId: number;
}