import express, { Request, Response } from 'express';
import multer from 'multer';
import { User } from '../types/types';
import db from '../utils/db';
import { createId, checkField, resTemplate, codes, dbError, setCondition }  from '../utils';
import {  setToken } from '../utils/token';
import { UserInfo } from '../types/user';
import { getRoleName, getUserPermissions, setLog } from '../utils/business';
import { pickRandomDefaultAvatar, DEFAULT_AVATAR } from '../utils/defaultAvatars';
import { generateFileName, saveUploadedFile } from '../utils/storage';
import { getOssPublicUrl, isOssEnabled } from '../utils/oss';
import { env, isDev, hostname } from '../config';

const faceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const toFacePublicUrl = (relativePath: string): string => {
  if (isOssEnabled()) return getOssPublicUrl(relativePath);
  if (isDev) return `http://127.0.0.1:${env.port}${relativePath}`;
  return `${hostname}${relativePath}`;
};

const users: User[] = [];
const router = express.Router();


export const addUser = (newUser: User) => {
  users.push(newUser);
};

export const getUser = (user: User) => {
  return users.find(
    (u) => u.username === user.username && u.password === user.password
  );
};


/**
 * @api {post} /api/user/register 用户注册
 * @apiName 用户注册
 * @apiGroup User
 *
 * @apiParam {String} username 用户名
 * @apiParam {String} password 密码
 * @apiParam {String} phone 手机号
 * @apiParam {String} gender 性别 0未知 1男 2女
 *
 */
router.post('/register', (req, res) => {
  const {
    userName,
    password,
    phone,
    gender = 0,
    email,
    createTime = new Date(),
  } = req.body;

  if (checkField(userName, res, '用户名')) return;
  if (checkField(password, res, '密码')) return;
  if (checkField(phone, res, '手机号')) return;
  
  const uid = createId();
  const face = pickRandomDefaultAvatar();
  const values = [userName, password, phone, gender, uid, createTime, face];
  const sql = 'INSERT INTO users(userName, `password`, phone, gender, uid, createTime, face) VALUES(?, ?, ?, ?, ?, ?, ?)';
  const selectSql = `select userName, phone FROM users WHERE userName=? OR phone=?`;
  db.query(selectSql, [userName, phone], (err: null|object, data: any) => {
    if (err) {
      dbError(err, res);
      return;
    }

    if (data.length > 0) {
      const first = data[0];
      let msg = '用户名或手机号';
      if (first.userName === userName) {
        msg = '用户名'
      }
      if (first.phone === phone) {
        msg = '手机号'
      }
      resTemplate(999, `${msg}已被注册`, res);
      return;
    }

    db.query(sql, values, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.insertId || result.affectedRows > 0) {
        resTemplate(200, '注册成功', res);
        return;
      }
      resTemplate(codes.error, '注册失败', res);
    });
  })
});


/**
 * @api {post} /api/user/login
 * @apiName 用户登录
 * @apiGroup User
 *
 * @apiParam {String} username 用户名
 * @apiParam {String} password 密码
 */
router.post('/login', (req: any, res: any) => {
  const {
    userName,
    password,
  } = req.body;
  if (checkField(userName, res, '用户名')) return;
  if (checkField(password, res, '密码')) return;
  const sql = 'SELECT userName, uid, id, phone, gender, email, roleCode, roleName, face, status FROM users WHERE userName=? AND `password`=?';
  db.query(sql, [userName, password], (err, result) => {
    if (err) {
      dbError(err, res);
      return;
    }
    if (result.length === 1) {
      const userInfo: UserInfo = result[0];

      if (userInfo.status === 2) {
        resTemplate(codes.error, '用户已被冻结！请联系管理员', res);
        return;
      }
     
      setToken(userInfo).then(token => {
        resTemplate(200, '登录成功', res, { ...userInfo, token });
      })
      return;
    }
    resTemplate(codes.error, '用户名或密码不正确', res);
  })
})

/**
 * @api {post} /api/user/logout
 * @apiName 用户退出登录
 * @apiGroup User
 * 
 */
router.post('/logout', (req: Request, res: Response ) => {
  getUserPermissions(req)?.then(data => {
    const { userInfo } = data;
    if (data && userInfo) {
      setToken(userInfo, '0s').then(() => {
        resTemplate(codes.success, '退出成功', res);
      }).catch(err => {
        resTemplate(codes.error, err || '退出失败', res);
      })
    } else {
      resTemplate(codes.error, 'token错误', res);
    }
  }).catch(error => {
    resTemplate(error.code, error.message, res);
  })
})

/**
 * @api {post} /api/user/info/:id
 * @apiName 查看他人或主页
 * @apiGroup User
 * 
 */
router.get('/info/:id', (req, res) => {
  const { id } = req.params;
  if (checkField(id, res, '用户id不能为空')) return;

  const selectSql = `
    SELECT
    id,
    uid,
    userName,
    gender,
    createTime,
    roleCode,
    roleName,
    face 
  FROM
    users 
  WHERE
    id = ?
  `;
  
  db.query(selectSql, id, (err, result) => {
    if (err) {
      dbError(err, res);
      return;
    }
    if (result.length > 0) {
      resTemplate(codes.success, '查询成功', res, result[0]);
      return;
    }
    resTemplate(codes.notViewData, '用户不存在', res);
  })
})

/**
 * @api {post} /api/user/checkPassword
 * @apiName 验证密码
 * @apiGroup User
 * 
 * @apiParam {String} password 用户名
 */
router.post('/checkPassword', (req, res) => {
  getUserPermissions(req, false).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { password } = req.body;
    const select = `SELECT password FROM users WHERE uid=? AND password=?`;
    
    if (checkField(uid, res, '', '用户未登录')) return;
    
    db.query(select, [uid, password], (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (data.length > 0) {
        resTemplate(codes.success, '密码验证正确', res);
        return;
      }
      resTemplate(codes.error, '密码不正确', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/user/update/password
 * @apiName 修改密码
 * @apiGroup User
 * 
 * @apiParam {String} newPassword 密码
 */
router.post('/update/password', (req, res) => {
  getUserPermissions(req, false).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { newPassword } = req.body;
    const update = `UPDATE users SET password=? WHERE uid=?`;
    
    if (checkField(newPassword, res, '新密码')) return;
    
    db.query(update, [newPassword, uid], (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.affectedRows) {
        resTemplate(codes.success, '修改成功', res);
        return;
      }
      resTemplate(codes.error, '修改失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/** 上传头像到 OSS（仅上传，不写库） */
router.post('/upload/face', faceUpload.any(), async (req, res) => {
  try {
    const data = await getUserPermissions(req, false);
    const { userInfo } = data;
    const firstFile = Array.isArray(req.files) && req.files.length > 0 ? req.files[0] : null;

    if (!firstFile) {
      resTemplate(codes.error, '请上传文件', res);
      return;
    }

    const lastIndex = firstFile.originalname.lastIndexOf('.');
    const suffix = lastIndex >= 0 ? firstFile.originalname.slice(lastIndex) : '.jpg';
    const savedName = generateFileName(`${userInfo?.userName || 'face'}${suffix}`);

    const { url } = await saveUploadedFile(
      firstFile.buffer,
      'face',
      savedName,
      firstFile.mimetype,
    );

    const publicUrl = toFacePublicUrl(url);
    resTemplate(codes.success, '上传成功', res, {
      fileName: savedName,
      fileSize: firstFile.size,
      fileType: firstFile.mimetype,
      url,
      publicUrl,
    });
  } catch (err: any) {
    resTemplate(err?.code ?? codes.error, err?.message ?? '上传失败', res);
  }
});

/** 更新用户头像地址（OSS 上传完成后调用） */
router.post('/update/face', (req, res) => {
  getUserPermissions(req, false)
    .then((data) => {
      const uid = data.userInfo?.uid ?? '';
      const { face } = req.body || {};

      if (checkField(uid, res, '', '用户id不能为空')) return;
      if (checkField(face, res, '头像地址')) return;

      db.query('UPDATE users SET face=? WHERE uid=?', [face, uid], (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        if (result.affectedRows) {
          resTemplate(codes.success, '头像更新成功', res, { face });
          return;
        }
        resTemplate(codes.error, '头像更新失败', res);
      });
    })
    .catch((err) => {
      resTemplate(err.code, err.message, res);
    });
});

/** 恢复默认头像 */
router.post('/face/reset', (req, res) => {
  getUserPermissions(req, false)
    .then((data) => {
      const uid = data.userInfo?.uid ?? '';
      if (checkField(uid, res, '', '用户id不能为空')) return;

      db.query('UPDATE users SET face=? WHERE uid=?', [DEFAULT_AVATAR, uid], (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        if (result.affectedRows) {
          resTemplate(codes.success, '已恢复默认头像', res, { url: DEFAULT_AVATAR });
          return;
        }
        resTemplate(codes.error, '恢复失败', res);
      });
    })
    .catch((err) => {
      resTemplate(err.code, err.message, res);
    });
});

/**
 * @api {post} /api/user/page
 * @apiName 用户列表
 * @apiGroup User
 * 
 * @apiParam {Number} current 
 * @apiParam {Number} pageSize 
 * @apiParam {String} userName 用户名 
 * @apiParam {String} phone 手机号
 * @apiParam {String} email 邮箱 
 * @apiParam {Number} gender 性别 
 * @apiParam {Number} status 状态
 */
router.post('/page', async(req, res) => {
  getUserPermissions(req).then(async(data) => {
    const { 
      current = 1, 
      pageSize = 20,
      userName,
      phone,
      email,
      gender,
      status,
    } = req.body;

    const totalPromise = new Promise(resolve => {
      const sql = `SELECT COUNT(id) total FROM users`;
      db.query(sql, (err, data) => {
        if (err) {
          dbError(err, res);
        }
        resolve(data);
      })
    })

    const selectPromise = new Promise(resolve => {
      const condition = setCondition([
        {
          fieldName: 'userName',
          value: userName,
          fuzzy: true
        },
        {
          fieldName: 'phone',
          value: phone,
          fuzzy: true
        },
        {
          fieldName: 'email',
          value: email,
          fuzzy: true
        },
        {
          fieldName: 'gender',
          value: gender,
        },
        {
          fieldName: 'status',
          value: status,
        },
      ])
      const sql = `
        SELECT 
          id,uid,userName,phone,gender,createTime,email,roleName,face,roleCode, status
        FROM users 
        ${condition} LIMIT ${(current - 1) * pageSize}, ${pageSize}
      `;

      db.query(sql, (err, data) => {
        if (err) {
          dbError(err, res);
          return;
        }
        resolve(data);
      })
    })

    await Promise.all<any>([totalPromise, selectPromise]).then(datas => {
      const [total, data] = datas;
      resTemplate(codes.success, '查询成功', res, {
        current,
        pageSize,
        total: total[0]?.total || 0,
        dataSource: data,
      });
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/user/change/status
 * @apiName 修改用户状态
 * @apiGroup User
 * 
 * @apiParam {Number} status 修改的状态 
 * @apiParam {Number} id 用户ID 
 */
router.post('/change/status', (req, res) => {
  getUserPermissions(req).then(data => {
    const { id, status } = req.body;
    const { userInfo } = data;
    const userName = userInfo?.userName;
    const selectSql = `SELECT id, status, userName FROM users WHERE id=?`;
    const updateSql = `UPDATE users SET status=? WHERE id=?`;

    if (checkField(id, res, '用户ID')) return;
    if (checkField(status, res, '用户状态')) return;
    
    db.query(selectSql, id, (err, data) => {
      if (err) {
        dbError(err, res);
        return;
      }

      const handleUser: UserInfo = data[0];

      if (!handleUser) {
        resTemplate(codes.error, '用户不存在', res);
        return;
      }

      if (handleUser.status === Number(status)) {
        resTemplate(codes.error, '修改和状态和原状态一致', res);
        return;
      }

      db.query(updateSql, [status, id], (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        const content = `${userName}修改了用户{${handleUser.userName}}状态 状态${status}`;

        if (!result.affectedRows) {
          resTemplate(codes.error, '修改失败', res);
          setLog(req, {
            apiName: '修改用户状态',
            title: '用户模块',
            code: codes.error,
            content
          })
          return;
        }
        setLog(req, {
          apiName: '修改用户状态',
          title: '用户模块',
          code: codes.success,
          content
        })
        resTemplate(codes.success, '修改成功', res);
      })
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/user/edit
 * @apiName 修改用户状态
 * @apiGroup User
 * 
 * @apiParam {String} phone 手机号 
 * @apiParam {String} email 邮箱 
 * @apiParam {Number} roleCode 角色 
 * @apiParam {Number} gender 性别 
 */
router.post('/edit', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const { phone, email, roleCode, gender, id } = req.body;

    if (checkField(id, res, '用户ID')) return;
    if (checkField(phone, res, '手机号')) return;
    if (checkField(roleCode, res, '角色')) return;

    const updateSql = `UPDATE users SET phone=?, email=?, roleCode=?, gender=?, roleName=?  WHERE id=?`;
    const selectSql = `SELECT userName FROM users WHERE id = ?`;
    const values = [phone, email, roleCode, gender, getRoleName(Number(roleCode)), id];

    db.query(selectSql, id, (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }

      const handleUser: UserInfo = result[0];
      if (!handleUser) {
        resTemplate(codes.error, '用户不存在', res);
        return;
      }

      db.query(updateSql, values, (err, result) => {
        if (err) {
          dbError(err, res);
          return;
        }
        const content = `${userInfo?.userName}修改了用户资料 用户：${handleUser.userName}`
  
        if (!result.affectedRows) {
          setLog(req, {
            apiName: '修改用户资料',
            title: '用户模块',
            code: codes.error,
            content,
          })
          resTemplate(codes.error, '修改失败', res);
          return;
        }

        setLog(req, {
          apiName: '修改用户资料',
          title: '用户模块',
          code: codes.success,
          content,
        })
        resTemplate(codes.success, '修改成功', res);
      })

    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})

/**
 * @api {post} /api/user/resetPassword
 * @apiName 重置密码
 * @apiGroup User
 * 
 * @apiParam {String} newPassword 密码
 */
 router.post('/resetPassword', (req, res) => {
  getUserPermissions(req).then(data => {
    const { userInfo } = data;
    const uid = userInfo?.uid??'';
    const { newPassword } = req.body;
    const update = `UPDATE users SET password=? WHERE uid=?`;
    
    if (checkField(newPassword, res, '新密码')) return;
    
    db.query(update, [newPassword, uid], (err, result) => {
      if (err) {
        dbError(err, res);
        return;
      }
      if (result.affectedRows) {
        resTemplate(codes.success, '修改成功', res);
        return;
      }
      resTemplate(codes.error, '修改失败', res);
    })
  }).catch(err => {
    resTemplate(err.code, err.message, res);
  })
})


export default router;
