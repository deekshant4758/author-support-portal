import type { Request } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { validationFailed } from '../lib/errors';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Parse and replace a request part with validated output. Returning a 422 with
 * field-level details keeps client error handling predictable.
 */
export const validate =
  <T extends ZodTypeAny>(schema: T, part: RequestPart = 'body') =>
  (req: Request, _res: unknown, next: (err?: unknown) => void) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(validationFailed(result.error.flatten()));
    }
    // Express 4 request query/params are getters in some versions; assigning the
    // parsed value is safe for body and for our typed, validated query objects.
    (req as Request & Record<RequestPart, z.infer<T>>)[part] = result.data;
    return next();
  };
