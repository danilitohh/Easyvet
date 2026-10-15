import { z } from 'zod';

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url(),
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
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
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
  if (typeof databaseUrl === 'string') {
    // Prisma's generated client reads DATABASE_URL directly at runtime.
    process.env.DATABASE_URL ??= databaseUrl;
  }

  return environmentSchema.parse({ ...raw, DATABASE_URL: databaseUrl });
}
