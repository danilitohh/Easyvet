import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { assertSafeStorageKey, StorageAdapter } from './storage.service';

type S3StorageOptions = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
};

// S3-compatible storage uses only opaque generated keys and explicit credentials from environment config.
@Injectable()
export class S3CompatibleStorageAdapter extends StorageAdapter implements OnModuleDestroy {
  private readonly client: S3Client;

  constructor(private readonly options: S3StorageOptions) {
    super();
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey,
      },
    });
  }

  async put(key: string, bytes: Buffer, mimeType: string): Promise<void> {
    assertSafeStorageKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    assertSafeStorageKey(key);
    const { Body } = await this.client.send(
      new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
    );
    if (!Body) throw new Error('Stored object has no response body');
    const chunks: Buffer[] = [];
    for await (const chunk of Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async exists(key: string): Promise<boolean> {
    assertSafeStorageKey(key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key: key }));
      return true;
    } catch (error) {
      const response = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (response.name === 'NotFound' || response.$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }

  // This is reserved for compensating an interrupted technical write, never a clinical void.
  async deleteForRollback(key: string): Promise<void> {
    assertSafeStorageKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
