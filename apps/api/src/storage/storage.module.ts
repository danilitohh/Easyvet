import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3CompatibleStorageAdapter } from './s3-storage.adapter';
import { STORAGE_SERVICE } from './storage.service';

// Storage selection is centralized so feature services never depend on a vendor implementation.
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => {
        if (config.get('STORAGE_DRIVER', { infer: true }) === 's3') {
          return new S3CompatibleStorageAdapter({
            endpoint: config.get('STORAGE_S3_ENDPOINT', { infer: true })!,
            region: config.get('STORAGE_S3_REGION', { infer: true }),
            bucket: config.get('STORAGE_S3_BUCKET', { infer: true })!,
            accessKey: config.get('STORAGE_S3_ACCESS_KEY', { infer: true })!,
            secretKey: config.get('STORAGE_S3_SECRET_KEY', { infer: true })!,
            forcePathStyle: config.get('STORAGE_S3_FORCE_PATH_STYLE', { infer: true }),
          });
        }
        return new LocalStorageAdapter(config.get('STORAGE_LOCAL_ROOT', { infer: true }));
      },
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
