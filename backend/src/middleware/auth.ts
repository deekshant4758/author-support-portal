import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from '../lib/errors';
import { verifyAccessToken } from '../lib/auth';
import type { UserRole } from '../types/auth';

const extractBearer = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

/**
 * Verifies the JWT **and** reloads the user from the database. The DB lookup
 * means deleted/demoted users lose access immediately instead of waiting for
 * their token to expire.
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = extractBearer(req);
    if (!token) throw unauthorized('Missing bearer token.');

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, authorId: true },
    });
    if (!user) throw unauthorized('This account no longer exists.');

    req.user = { ...user, role: user.role as UserRole };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`This endpoint is restricted to ${roles.join(' / ')} accounts.`));
    }
    return next();
  };

export const requireAuthor = requireRole('AUTHOR');
export const requireAdmin = requireRole('ADMIN');
