import { randomBytes } from 'node:crypto';

// Generate a secure random token
export function generateToken(): string {
  return randomBytes(16).toString('hex');
}

// Validate token format
export function isValidToken(token: string): boolean {
  return /^[a-f0-9]{32}$/.test(token);
}
