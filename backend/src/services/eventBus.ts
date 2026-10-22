import type { Response } from 'express';
import type { UserRole } from '../types/auth';

export interface PortalEvent {
  type: 'connected' | 'ticket.created' | 'ticket.updated' | 'ticket.message' | 'ticket.closed' | 'heartbeat';
  ticketId?: string;
  ticketPublicId?: string;
  authorId?: string | null;
  data?: unknown;
  at?: string;
  adminOnly?: boolean;
}

interface Subscriber {
  id: number;
  res: Response;
  role: UserRole;
  userId: string;
  authorId: string | null;
}

/**
 * Server-Sent Events give us near-real-time updates with no extra service.
 * For a multi-instance deployment this would move to Redis pub/sub; the public
 * interface (`publishEvent`) would not change.
 */
class EventBus {
  private subscribers = new Set<Subscriber>();
  private nextId = 1;
  private heartbeat: NodeJS.Timeout;

  constructor() {
    this.heartbeat = setInterval(() => {
      for (const sub of this.subscribers) {
        safeWrite(sub.res, { type: 'heartbeat', at: new Date().toISOString() });
      }
    }, 25_000);
    this.heartbeat.unref?.();
  }

  subscribe(res: Response, user: { id: string; role: UserRole; authorId: string | null }): number {
    const id = this.nextId++;
    const subscriber: Subscriber = {
      id,
      res,
      role: user.role,
      userId: user.id,
      authorId: user.authorId,
    };
    this.subscribers.add(subscriber);
    return id;
  }

  unsubscribe(id: number) {
    for (const sub of this.subscribers) {
      if (sub.id === id) this.subscribers.delete(sub);
    }
  }

  publish(event: PortalEvent) {
    const payload = { ...event, at: event.at ?? new Date().toISOString() };
    for (const sub of this.subscribers) {
      // Admins see every support event; authors only see events on their own
      // tickets. This is enforced server-side, not in the browser.
      const isAdmin = sub.role === 'ADMIN';
      const isOwner = !event.adminOnly && event.authorId != null && sub.authorId === event.authorId;
      if (isAdmin || isOwner) safeWrite(sub.res, payload);
    }
  }

  get connectionCount() {
    return this.subscribers.size;
  }
}

const safeWrite = (res: Response, payload: PortalEvent) => {
  try {
    res.write(`event: ${payload.type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // Broken pipe - the close handler will unsubscribe.
  }
};

export const eventBus = new EventBus();

export const publishTicketEvent = (event: PortalEvent) => {
  eventBus.publish(event);
};

export const sseStats = () => ({ connectedClients: eventBus.connectionCount });
