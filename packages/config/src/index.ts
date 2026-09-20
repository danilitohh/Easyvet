import { z } from 'zod';

// Shared environment primitives keep application-specific settings in their owning app.
export const nodeEnvironmentSchema = z.enum(['development', 'test', 'production']);

export const appNameSchema = z.string().trim().min(1).max(120);

export type NodeEnvironment = z.infer<typeof nodeEnvironmentSchema>;
