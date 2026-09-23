import { SetMetadata } from '@nestjs/common';

// Marks the small authenticated endpoints available while a user must replace a temporary password.
export const PASSWORD_CHANGE_ALLOWED_KEY = 'password-change-allowed';

export function PasswordChangeAllowed() {
  return SetMetadata(PASSWORD_CHANGE_ALLOWED_KEY, true);
}
