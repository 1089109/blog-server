export interface CodeDetail {
    TotalCount: number;
    Message: string;
    RequestId: string;
    Code: string;
    SmsSendDetailDTOs: {
      SmsSendDetailDTO: {
        TemplateCode: string;
        ReceiveDate: string;
        PhoneNum: string;
        Content: string;
        SendStatus: number;
        SendDate: string;
        ErrCode: string;
      }[]
    }
}

export interface SendResult {
  Message: string;
  RequestId: string;
  Code: string;
  BizId: string;
}