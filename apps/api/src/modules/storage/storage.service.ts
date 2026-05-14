import { Injectable } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.STORAGE_BUCKET ?? 'vouchrex-evidence';

    const accessKeyId = process.env.STORAGE_ACCESS_KEY;
    const secretAccessKey = process.env.STORAGE_SECRET_KEY;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY must be set.');
    }

    const config: S3ClientConfig = {
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
      credentials: { accessKeyId, secretAccessKey },
      region: 'us-east-1',
    };
    if (process.env.STORAGE_ENDPOINT) {
      config.endpoint = process.env.STORAGE_ENDPOINT;
    }
    this.s3 = new S3Client(config);
  }

  async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  }

  async getSignedUrl(key: string, ttlSeconds = 900): Promise<string> {
    return presign(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds }
    );
  }
}
