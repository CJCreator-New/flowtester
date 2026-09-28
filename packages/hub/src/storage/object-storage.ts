import { promises as fs } from 'fs';
import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PreSignedUploadInfo {
  uploadUrl: string;
  storageKey: string;
}

export interface IObjectStorage {
  generatePreSignedUploadUrl(
    runId: string,
    clientKey: string,
    mimeType: string
  ): Promise<PreSignedUploadInfo>;

  saveObject(storageKey: string, data: Buffer | Uint8Array): Promise<void>;
  getObject(storageKey: string): Promise<Buffer | null>;
  hasObject(storageKey: string): Promise<boolean>;
}

export class LocalObjectStorage implements IObjectStorage {
  private baseDir: string;
  private serverOrigin: string;

  constructor(baseDir?: string, serverOrigin?: string) {
    this.baseDir = path.resolve(baseDir || path.join(process.cwd(), '.qa-hub-storage'));
    this.serverOrigin = serverOrigin || 'http://localhost:3001';
  }

  async generatePreSignedUploadUrl(
    runId: string,
    clientKey: string,
    _mimeType: string
  ): Promise<PreSignedUploadInfo> {
    const cleanKey = clientKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const storageKey = `runs/${runId}/${cleanKey}`;
    const uploadUrl = `${this.serverOrigin}/api/v1/evidence/upload?key=${encodeURIComponent(storageKey)}`;

    return {
      uploadUrl,
      storageKey,
    };
  }

  async saveObject(storageKey: string, data: Buffer | Uint8Array): Promise<void> {
    const filePath = path.join(this.baseDir, storageKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async getObject(storageKey: string): Promise<Buffer | null> {
    const filePath = path.join(this.baseDir, storageKey);
    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  async hasObject(storageKey: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, storageKey);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export interface S3StorageConfig {
  endpoint: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  publicUrl?: string;
}

export class S3ObjectStorage implements IObjectStorage {
  private client: S3Client;
  private bucket: string;
  public readonly publicUrl?: string;
  private bucketChecked = false;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? true,
    });
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketChecked) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketChecked = true;
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.bucketChecked = true;
      } catch {
        this.bucketChecked = true;
      }
    }
  }

  async generatePreSignedUploadUrl(
    runId: string,
    clientKey: string,
    mimeType: string
  ): Promise<PreSignedUploadInfo> {
    await this.ensureBucket();
    const cleanKey = clientKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const storageKey = `runs/${runId}/${cleanKey}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });
    return {
      uploadUrl,
      storageKey,
    };
  }

  async saveObject(storageKey: string, data: Buffer | Uint8Array): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: data,
      })
    );
  }

  async getObject(storageKey: string): Promise<Buffer | null> {
    await this.ensureBucket();
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        })
      );
      if (!response.Body) return null;
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch {
      return null;
    }
  }

  async hasObject(storageKey: string): Promise<boolean> {
    await this.ensureBucket();
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        })
      );
      return true;
    } catch {
      return false;
    }
  }
}

export function createStorageFromEnv(serverOrigin?: string): IObjectStorage {
  if (process.env.S3_ENDPOINT || process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) {
    return new S3ObjectStorage({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET || 'qa-evidence',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      publicUrl: process.env.S3_PUBLIC_URL,
    });
  }
  return new LocalObjectStorage(undefined, serverOrigin);
}
