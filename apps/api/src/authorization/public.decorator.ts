import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'easyvet:isPublic';

// Marks the intentionally unauthenticated liveness and login endpoints.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
