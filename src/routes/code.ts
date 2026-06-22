import express from 'express';
import { Op } from 'sequelize';
const router = express.Router();
import { resTemplate, checkField, codes } from '../utils';
//@ts-ignore
import Core from '@alicloud/pop-core';
import { CodeDetail, SendResult } from '../types/code';
import moment from 'moment';
import { env } from '../config';
import { SmsCode } from '../models';

const CODE_TTL_MINUTES = 10;

function createSmsClient() {
  return new Core({
    accessKeyId: env.sms.accessKeyId,
    accessKeySecret: env.sms.accessKeySecret,
    endpoint: 'https://dysmsapi.aliyuncs.com',
    apiVersion: '2017-05-25',
  });
}

function generateCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

function normalizeCode(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '').padStart(6, '0').slice(-6);
}

function isExpired(sendTime: Date | string): boolean {
  return moment().subtract(CODE_TTL_MINUTES, 'minutes').isAfter(moment(sendTime));
}

async function cleanupExpiredCodes(phone: string) {
  const expiredBefore = moment().subtract(CODE_TTL_MINUTES, 'minutes').toDate();
  await SmsCode.destroy({
    where: {
      phone: String(phone),
      create_time: { [Op.lt]: expiredBefore },
    },
  });
}

/** 阿里云 QuerySendDetails：查发送记录，从短信正文提取 6 位验证码（无直接校验接口） */
async function verifyFromAliyun(phone: string, inputCode: string): Promise<boolean> {
  try {
    const client = createSmsClient();
    const result = await client.request<CodeDetail>(
      'QuerySendDetails',
      {
        PhoneNumber: phone,
        SendDate: moment().format('YYYYMMDD'),
        PageSize: 10,
        CurrentPage: 1,
      },
      { method: 'POST', formatParams: false },
    );

    const rawList = result?.SmsSendDetailDTOs?.SmsSendDetailDTO;
    const list = Array.isArray(rawList) ? rawList : rawList ? [rawList] : [];
    const normalized = normalizeCode(inputCode);

    for (const item of list) {
      const match = item?.Content?.match(/\d{6}/);
      if (!match || normalizeCode(match[0]) !== normalized) continue;
      if (!item?.SendDate || isExpired(item.SendDate)) continue;
      // SendStatus 3 = 发送成功
      if (Number(item.SendStatus) !== 3) continue;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function verifyCode(phone: string, inputCode: string): Promise<boolean> {
  const normalized = normalizeCode(inputCode);
  await cleanupExpiredCodes(phone);

  const records = await SmsCode.findAll({ where: { phone: String(phone) } });
  const matched = records.find(
    (r) => normalizeCode(r.code) === normalized && !isExpired(r.create_time),
  );

  if (matched) {
    await matched.destroy();
    return true;
  }

  return verifyFromAliyun(String(phone), normalized);
}

/**
 * @api {post} /api/code/checked
 * @apiName 核对验证码
 * @apiGroup Code
 */
router.post('/checked', async (req, res) => {
  const { code, phone } = req.body || {};

  if (checkField(code, res, '验证码')) return;
  if (checkField(phone, res, '手机号码')) return;

  try {
    const ok = await verifyCode(String(phone), code);
    if (ok) {
      resTemplate(codes.success, '验证成功', res);
      return;
    }
    resTemplate(codes.error, '验证码错误或已失效，请重新获取', res);
  } catch {
    resTemplate(codes.error, '查询失败', res);
  }
});

/**
 * @api {post} /api/code/submit
 * @apiName 发送验证码
 * @apiGroup Code
 */
router.post('/submit', async (req, res) => {
  const { phone } = req.body || {};

  if (checkField(phone, res, '手机号')) return;

  const smsCode = generateCode();
  const client = createSmsClient();

  const params = {
    SignName: env.sms.signName,
    TemplateCode: env.sms.templateCode,
    PhoneNumbers: phone,
    TemplateParam: JSON.stringify({ code: smsCode }),
  };

  const requestOption = {
    method: 'POST',
    formatParams: false,
  };

  try {
    const result = await client.request<SendResult>('SendSms', params, requestOption);
    const resultCode = result?.Code;

    if (resultCode === 'OK') {
      await cleanupExpiredCodes(String(phone));
      await SmsCode.create({
        phone: String(phone),
        code: smsCode,
        create_time: new Date(),
      });
      if (env.isDev) {
        console.log(`[SMS] phone=${phone} code=${smsCode}`);
      }
      resTemplate(codes.success, '发送成功', res);
      return;
    }

    if (resultCode === 'isv.BUSINESS_LIMIT_CONTROL') {
      resTemplate(codes.error, '发送失败,每小时最多发送5条验证码，每天最多发送10条验证码', res);
      return;
    }

    resTemplate(codes.error, result?.Message || '发送失败', res, JSON.stringify(result));
  } catch (ex: unknown) {
    const err = ex as { data?: { Message?: string } };
    const content = err?.data?.Message;
    switch (content) {
      case '触发分钟级流控Permits:1':
        resTemplate(codes.error, '发送失败, 每分钟最多发送1条验证码', res);
        break;
      case '触发小时级流控Permits:5':
        resTemplate(codes.error, '发送失败, 每小时最多发送5条验证码', res);
        break;
      default:
        resTemplate(codes.error, content || '发送失败', res, JSON.stringify(ex));
    }
  }
});

export default router;
