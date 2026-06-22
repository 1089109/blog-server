declare module 'ali-oss' {
  interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
  }

  interface PutOptions {
    mime?: string;
  }

  interface ListObject {
    name?: string;
  }

  interface ListResult {
    objects?: ListObject[];
    isTruncated?: boolean;
    nextMarker?: string;
  }

  class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: Buffer, options?: PutOptions): Promise<unknown>;
    delete(name: string): Promise<unknown>;
    copy(name: string, sourceName: string): Promise<unknown>;
    list(query: Record<string, unknown>, options?: Record<string, unknown>): Promise<ListResult>;
  }

  export = OSS;
}
