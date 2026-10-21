import type { UserRole } from './auth';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        authorId: string | null;
      };
    }
  }
}

export {};
