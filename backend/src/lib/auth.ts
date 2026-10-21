import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from './errors';
import type { UserRole } from '../types/auth';

export interface TokenPayload {
  sub: string;
  role: UserRole;
  authorId: string | null;
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export const signAccessToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'bookleaf-support',
    audience: 'bookleaf-portal',
  });

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'bookleaf-support',
      audience: 'bookleaf-portal',
    });
    if (typeof decoded === 'string' || !decoded.sub) throw new Error('Malformed token');
    return {
      sub: String(decoded.sub),
      role: (decoded as jwt.JwtPayload).role as UserRole,
      authorId: ((decoded as jwt.JwtPayload).authorId as string | null) ?? null,
    };
  } catch {
    throw unauthorized('Your session is invalid or has expired. Please sign in again.');
  }
};
