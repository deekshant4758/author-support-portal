import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/auth';
import { eventBus } from '../services/eventBus';
import type { UserRole } from '../types/auth';
import { asyncHandler } from '../lib/asyncHandler';

export const eventsRouter = Router();

/**
 * EventSource cannot send an Authorization header, so the short-lived JWT is
 * passed as a query parameter. It is verified exactly like the header token and
 * the stream is scoped by role/author on the server.
 */
eventsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing stream token.' } });
      return;
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid stream token.' } });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, authorId: true },
    });
    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Account not found.' } });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const subscriberId = eventBus.subscribe(res, {
      id: user.id,
      role: user.role as UserRole,
      authorId: user.authorId,
    });

    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ type: 'connected', at: new Date().toISOString() })}\n\n`);

    const close = () => {
      eventBus.unsubscribe(subscriberId);
      res.end();
    };
    req.on('close', close);
    req.on('error', close);
  }),
);
