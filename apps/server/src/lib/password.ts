import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const ALL = UPPER + LOWER + DIGITS;

export function generateTemporaryPassword(): string {
  const pick = (charset: string) => charset[randomInt(charset.length)];
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  for (let i = 0; i < 9; i++) chars.push(pick(ALL));
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
