// src/lib/passwords.ts
//
// Passwords are stored as bcrypt hashes (never readable). Accounts created
// before this change still have their password stored as plain text; those
// keep working, and are switched to a hash automatically the next time that
// person logs in successfully.

import { compare, hash } from "bcryptjs";

const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/;

export function isHashed(stored: string | null | undefined): boolean {
  return !!stored && BCRYPT_PATTERN.test(stored);
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 10);
}

/** Checks a typed password against what's stored. `needsUpgrade` is true
 * when it matched an old plain-text password that should now be hashed. */
export async function verifyPassword(
  plain: string,
  stored: string | null | undefined
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (!stored || !plain) return { ok: false, needsUpgrade: false };
  if (isHashed(stored)) {
    return { ok: await compare(plain, stored), needsUpgrade: false };
  }
  const ok = plain === stored;
  return { ok, needsUpgrade: ok };
}
