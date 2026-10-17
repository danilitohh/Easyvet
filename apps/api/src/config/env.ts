import { z } from 'zod';

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url(),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional(),
    SUPABASE_STORAGE_BUCKET: z.string().trim().min(1).default('easyvet-clinical-documents'),
    PLATFORM_ADMIN_BOOTSTRAP_SECRET: z.string().min(32).optional(),
    SUPABASE_JWT_SECRET: z.string().trim().min(1).optional(),
    APP_ORIGIN: z.string().url(),
    RESEND_API_KEY: z.string().trim().min(1).optional(),
    RESEND_FROM_EMAIL: z.string().trim().min(3).optional(),
    DEFAULT_CURRENCY_CODE: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{3}$/))
      .default('COP'),
    DEFAULT_INVOICE_PREFIX: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(
        z
          .string()
          .min(1)
          .max(16)
          .regex(/^[A-Z0-9-]+$/),
      )
      .default('INV'),
    SESSION_COOKIE_NAME: z.string().trim().min(1).max(80).default('easyvet_session'),
    SESSION_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 30)
      .default(168),
    STORAGE_DRIVER: z.enum(['local', 's3', 'supabase']).default('local'),
    STORAGE_LOCAL_ROOT: z.string().trim().min(1).default('.easyvet-storage'),
    STORAGE_S3_ENDPOINT: z.string().url().optional(),
    STORAGE_S3_REGION: z.string().trim().min(1).default('us-east-1'),
    STORAGE_S3_BUCKET: z.string().trim().min(1).optional(),
    STORAGE_S3_ACCESS_KEY: z.string().trim().min(1).optional(),
    STORAGE_S3_SECRET_KEY: z.string().trim().min(1).optional(),
    STORAGE_S3_FORCE_PATH_STYLE: z.preprocess(
      (value) => value === true || value === 'true',
      z.boolean().default(false),
    ),
    SIGNATURE_REQUEST_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(72),
    SIGNATURE_REQUEST_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production') {
      for (const [key, rawUrl] of [
        ['APP_ORIGIN', value.APP_ORIGIN],
        ['SUPABASE_URL', value.SUPABASE_URL],
        ['STORAGE_S3_ENDPOINT', value.STORAGE_S3_ENDPOINT],
      ] as const) {
        if (!rawUrl) continue;
        let protocol: string;
        try {
          protocol = new URL(rawUrl).protocol;
        } catch {
          continue;
        }
        if (protocol !== 'https:') {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} must use HTTPS in production`,
          });
        }
      }
    }

    if (value.STORAGE_DRIVER === 'supabase') {
      for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
        if (!value[key]) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when STORAGE_DRIVER=supabase`,
          });
        }
      }
    }

    if (value.STORAGE_DRIVER !== 's3') return;
    for (const key of [
      'STORAGE_S3_ENDPOINT',
      'STORAGE_S3_BUCKET',
      'STORAGE_S3_ACCESS_KEY',
      'STORAGE_S3_SECRET_KEY',
    ] as const) {
      if (!value[key]) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when STORAGE_DRIVER=s3`,
        });
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

// Parse environment variables once at the Nest configuration boundary.
export function validateEnvironment(raw: Record<string, unknown>): Environment {
  const databaseUrl = raw.DATABASE_URL ?? raw.POSTGRES_PRISMA_URL;
  const isVercelRuntime = raw.VERCEL === '1';
  const storageDriver = raw.STORAGE_DRIVER ?? (isVercelRuntime ? 'supabase' : 'local');

  if (isVercelRuntime && storageDriver === 'local') {
    throw new Error('Local file storage is not persistent or writable on Vercel; configure object storage');
  }

  if (typeof databaseUrl === 'string') {
    // Prisma's generated client reads DATABASE_URL directly at runtime.
    process.env.DATABASE_URL ??= databaseUrl;
  }

  return environmentSchema.parse({
    ...raw,
    DATABASE_URL: databaseUrl,
    STORAGE_DRIVER: storageDriver,
  });
}
