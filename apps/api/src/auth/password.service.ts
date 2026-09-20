import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

// Explicit Argon2id parameters keep password cost stable and reviewable across versions.
export const PASSWORD_HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon2.hash(password, PASSWORD_HASH_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      // Invalid or malformed stored hashes are treated as invalid credentials.
      return false;
    }
  }
}
