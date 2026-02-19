'use strict';

/**
 * Simple in-memory TTL cache.  Default TTL = 5 000 ms.
 * Each key stores { value, expiresAt }.
 */

class Cache {
  constructor(ttlMs = 5000) {
    this._ttl = ttlMs;
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this._store.set(key, { value, expiresAt: Date.now() + this._ttl });
  }

  clear() {
    this._store.clear();
  }
}

module.exports = Cache;
