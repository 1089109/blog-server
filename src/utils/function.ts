/*
 * @Author: HuangChaoYi
 * @email: 1089109@qq.com
 * @Date: 2021-10-01 00:09:59
 * @LastEditTime: 2024-10-10 09:25:29
 */
import { codes, uploadPath } from './config';
import os from 'os';
import fs from 'fs';
import moment from 'moment';
import { isDev, hostname } from '../config';
import { json, Request, Response } from 'express';
import { getFilePath, setFilePath } from './filePaths';



// 获取本机IP地址
const getIPAdress = function() {
  const interfaces = os.networkInterfaces();


  // 生产环境
  if (!isDev) {
    return hostname;
  } else {
    return 'http://localhost';
  }
}

/** 规范化 IP：去掉 ::ffff: 前缀 */
const normalizeIp = (raw?: string | null): string => {
  if (!raw) return '';
  let ip = String(raw).trim().replace(/^"|"$/g, '');
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
};

/** 获取当前请求用户的 IP（优先代理头） */
export const getClientIp = function (req: Request) {
  const reqExt = req as Request & { clientIP?: string };
  if (reqExt.clientIP) {
    return normalizeIp(reqExt.clientIP);
  }

  const xff = req.headers['x-forwarded-for'];
  const fromXff = Array.isArray(xff)
    ? xff[0]
    : typeof xff === 'string'
      ? xff.split(',')[0]
      : '';
  const candidates = [
    fromXff,
    req.headers['x-real-ip'],
    req.socket?.remoteAddress,
    // @ts-ignore legacy
    req.connection?.remoteAddress,
    req.ip,
  ];

  for (const c of candidates) {
    const ip = normalizeIp(typeof c === 'string' ? c : Array.isArray(c) ? c[0] : '');
    if (ip) return ip;
  }
  return '127.0.0.1';
};


// 文件地址
const fileHost = `${getIPAdress()||''}: ${isDev} ? '8080' : '80'}/`;


/** 生成指定范围的随机整数
 * start 开始的数字
 * end 结束的数字
 */
const randomInt = function(start: number, end: number) {
  return Math.round(Math.random() * ( end - start) + start );
}

/**
 * 响应模板
 * @param {number} code 
 * @param {string} msg 
 * @param {*} response 
 */
const resTemplate = function(code: number, msg: string, response: Response , data = {}): void {
  if (!response) {
    throw new Error('未传Res');
  }
  const resultCode = Number(code) || codes.error;
  const result = {
    code: resultCode,
    msg: msg || codes.errorText,
    data,
    success: resultCode === codes.success,
  };

  if (resultCode === codes.notLogin) {
    response.status(401);
  }

  response.json(result);
}

/**
 * 生成随机id
 * @param {number} num 位数
 * @returns string
 */
const createId = function(num = 0) {
  let id = '';
  const now = Date.now().toString();
  id = now.substr(0, 11) + now.substr(2, 6).split('').reverse().join('') + randomInt(1000, 9999);
  if (num === 0) {
    return id;
  }
  return id.substr(0, num);
}

/**
 *  验证字段是否为空
 * @param {*} str 需要的值
 * @param {*} response 响应对象
 * @param {*} fieldName 提示名字 + 不能为空
 * @param {*} allMessage 存在的话，就提示allMessage
 * @returns 
 */
const checkField = function(str: string|undefined|null, response: any, fieldName: string, allMessage?: string) {
  if (!response) {
    throw new Error('未传Res');
  }

  const notLoginMessage = [
    '用户未登录',
  ];
  const resultCode = notLoginMessage.includes(fieldName || '') || notLoginMessage.includes(allMessage || '') ? codes.notLogin : codes.error;

  if ([null, undefined, ''].includes(str)) {
    if (allMessage) {
      resTemplate(resultCode, allMessage, response);
      return true;
    };
    if (fieldName) {
      resTemplate(resultCode, `${fieldName}不能为空`, response);
      return true;
    }
    resTemplate(resultCode, `字段值校验未通过`, response);
    return true;
  }
  return false;
}

const dbError = function(error: any, res: any) {
  const msg =
    error?.sqlMessage ||
    error?.parent?.sqlMessage ||
    error?.message ||
    '数据库错误';
  return resTemplate(codes.dbError, msg, res);
};

const getFileSuffix = function(fileName: string) {
  return fileName.split('.')[1];
}

// 设置查询条件
/**
 *  验证字段是否为空
 * @param {Object Array} {array object} 需要添加到查询的字段和值
 * @returns String;
 * 
 * {
 *  fieldName 字段名
 *  value
 *  fuzzy?: '%'|'_'; // 是否模糊查询
 *  isAnd : boolean; // 条件连接符用 and 或 or  默认and
 * }
 */
interface SetConditionProps {
  fieldName: string; //字段名
  value?: any;
  fuzzy?: boolean; // 是否模糊查询 
  isAnd?: boolean; // 条件连接符用 and 或 or  默认and
} 

const setCondition = function(fields: SetConditionProps[] = []) {
  let condition = '';

  fields.map(item => {
    const { 
      fieldName,
      value,
      fuzzy = false,
      isAnd = true,
    } = item;
    const connector = isAnd ? 'AND' : 'OR';
    let newValue: string  = value;

    if (![undefined, null, ''].includes(newValue)) {
      if (fuzzy) {
        if (condition) {
          condition += ` ${connector} ${fieldName} LIKE '%${newValue}%'`;
          return;
        }
        condition = `WHERE ${fieldName} LIKE '%${newValue}%'`;
        return;
      }

      if ((typeof newValue) === 'string') {
        newValue = `'${value}'`;
      }

      
      if (condition) {
        condition += ` ${connector} ${fieldName}=${newValue}`;
        return;
      }
      condition = `WHERE ${fieldName}=${newValue}`;
    }
  })
  return condition;
}

// 根据排序对应是否需要排序；
/**
 * 
 * @param {Object} sorter 排序对象
 * @param {String}} tableName 表名, 有时候会有双对象
 * @returns string
 */
const setSorter = (sorter: object = {}, tableName = ''): string => {
  let result = '';
  const tableValue =tableName ? tableName + '.' : ''
  

  for ( const key in sorter) {
    // @ts-ignore
    const value = sorter[key];
    result = `ORDER BY ${tableValue + humpToline(key)} ${['descend', false, 'DESC'].includes(value) ? 'DESC' : 'ASC'}`;
  }

  return result ;
}

/**
 * 取对象指定属性的最后一个对象并返回
 * 
 * @param {object} obj 搜索的对象
 * @param {string} prop 对象属性
 * @returns obj
 */
const getLastObj = function(obj: any): (any|(() => any)) {
  if ('children' in obj) {
    return getLastObj(obj.children)
  } else {
    return obj;
  }
}


/**
 * 将已上传的文件从临时目录移动到指定目录
 * 
 * @param {String} fileName 要移动的文件名
 */
const moveFile = async function(fileName: string): Promise<string> {
  const { moveUploadedFile } = await import('./storage');
  return moveUploadedFile(fileName);
}

// 获取数据类型
export const getType = (value: any) => {
  return Object.prototype.toString.call(value).slice(8, -1);
}


/**
 * 
 * @param value 转换对象的key
 * @returns 
 */
const handleDownListTohump = (value: string): string => {
  let newValue = value;
  for (let i = 0; i < newValue.length; i++) {
    let val = newValue[i];
    if (val === '_') {
      let nextString = newValue.substr(i + 1, 1).toUpperCase(); // 转换成大写的字符
      let startString = newValue.slice(0, i); // _前的字符串
      let endString = newValue.slice(i + 2); // _后的字符串 加2位是不需要准备要替换的那个字符
      newValue = startString + nextString + endString;
    } 
  }
  return newValue;
}

/**
 * 将对象的字段从下划线改成小驼峰
 * 常见业务：mysql的字段是下划线的，返回前端需要转换成驼峰
 * api_name => apiName
 */

export const mysqlFieldTohump = (data: any) => {
  const type = getType(data)
  if ( type === 'Object') {
    for (let key in data) {
      let newKey = handleDownListTohump(key);
      let value = data[key];
      delete data[key];
      data[newKey] = value;
    }
  } else if (type === 'Array') {
    data.map((obj: any) => {
      for (let key in obj) {
        let newKey = handleDownListTohump(key);
        let value = obj[key];
        delete obj[key];
        obj[newKey] = value;
      }
    })
  } else if (type === 'String') {
    return handleDownListTohump(data);
  }

  return data;
}

/**
 * 驼峰转换成下划线
 */
export const humpToline = (str: string) => {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}


export {
  createId,
  randomInt,
  checkField,
  resTemplate,
  dbError,
  getFileSuffix,
  getIPAdress,
  setCondition,
  setSorter,
  getLastObj,
  fileHost,
  moveFile,
}