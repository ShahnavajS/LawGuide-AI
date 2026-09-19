import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

function scrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateAccountInput(name: string, email: string, password: string): string | null {
  if (name.trim().length < 2 || name.trim().length > 80) return 'Name must be between 2 and 80 characters.';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  if (password.length < 12 || password.length > 128) return 'Password must be between 12 and 128 characters.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include uppercase, lowercase, number, and symbol characters.';
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const key = await scrypt(password, salt);
  return `scrypt$16384$8$1$${salt}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, encoded, extra] = stored.split('$');
  if (algorithm !== 'scrypt' || n !== '16384' || r !== '8' || p !== '1' || !salt || !encoded || extra) return false;
  const actual = await scrypt(password, salt);
  const expected = Buffer.from(encoded, 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

