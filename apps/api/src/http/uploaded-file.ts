import type {} from 'multer';
import type { Request } from 'express';

// Keeps multipart payloads typed without leaking transport-specific file fields into domain services.
export type UploadedFile = NonNullable<Request['file']>;
