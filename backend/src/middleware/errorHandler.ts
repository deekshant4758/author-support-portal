import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `No API route matches ${req.method} ${req.originalUrl}.`,
    },
  });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? undefined },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted data is invalid.',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'The requested record does not exist.' },
      });
      return;
    }
    if (err.code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'A record with these unique details already exists.',
          details: err.meta,
        },
      });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({
        error: {
          code: 'INVALID_REFERENCE',
          message: 'A referenced record does not exist.',
        },
      });
      return;
    }
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' },
    });
    return;
  }

  // eslint-disable-next-line no-console
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      details: env.isProduction ? undefined : String(err),
    },
  });
};
