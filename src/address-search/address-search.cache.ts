import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

@Injectable()
export class AddressSearchCache implements OnModuleDestroy {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly cleanupTimer = setInterval(() => this.removeExpired(), 60_000);

  constructor() {
    this.cleanupTimer.unref();
  }

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
    this.entries.clear();
  }

  private removeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
