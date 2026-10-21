import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { signAccessToken, verifyPassword } from '../lib/auth';
import { unauthorized } from '../lib/errors';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema } from '../validation/schemas';
import { serializeUser } from '../lib/serialize';
import type { UserRole } from '../types/auth';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Please wait a few minutes and try again.',
    },
  },
});

authRouter.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            city: true,
            tier: true,
          },
        },
      },
    });

    // Same error for unknown email and bad password - avoids account enumeration.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized('Incorrect email or password.');
    }

    const token = signAccessToken({
      sub: user.id,
      role: user.role as UserRole,
      authorId: user.authorId,
    });

    res.json({
      data: {
        token,
        user: {
          ...serializeUser(user),
          author: user.author ?? null,
        },
      },
    });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        authorId: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true, city: true, tier: true } },
      },
    });

    if (!user) throw unauthorized('This account no longer exists.');
    res.json({ data: { user } });
  }),
);

/** JWTs are stateless, so logout is a client-side token discard. */
authRouter.post('/logout', authenticate, (_req, res) => {
  res.status(204).send();
});
