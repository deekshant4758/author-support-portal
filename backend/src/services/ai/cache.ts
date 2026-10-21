import { createHash } from 'node:crypto';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Deliberately tiny in-process cache. It eliminates duplicate spend when an
 * admin regenerates a draft with the same tone, or re-classifies an unchanged
 * ticket. A multi-instance deployment would use Redis, but the hit-rate win and
 * the interface stay the same.
 */
export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 200,
  ) {}

  private prune() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (!oldest) break;
      this.store.delete(oldest);
    }
  }

  get(key: string): T | undefined {
    this.prune();
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: T) {
    this.prune();
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : Number((this.hits / total).toFixed(3)),
      size: this.store.size,
    };
  }
}

export const hashKey = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 32);
