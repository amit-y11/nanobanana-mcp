import { createHash } from "node:crypto";
import { logger } from "./logger.js";

/**
 * Small TTL + size-capped cache, keyed by a stable hash of the full request.
 *
 * What it's for: agents retry tool calls (client hiccups, the model
 * re-issuing the same call, a user asking to "regenerate the exact same
 * thing"). Each Nano Banana call costs real money and multiple seconds, so
 * serving an identical, recent request from memory instead of re-hitting the
 * API is a meaningful win. It intentionally is NOT a semantic/fuzzy cache —
 * only byte-identical requests (same model, same prompt, same knobs, same
 * reference image bytes) hit, so results stay exactly as predictable as an
 * uncached call.
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlLruCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // Refresh recency for a simple LRU eviction order.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) break;
      this.store.delete(oldestKey);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1" || raw === "yes";
}

function intEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export const CACHE_ENABLED = boolEnv("NANOBANANA_CACHE_ENABLED", true);
const CACHE_TTL_MS = intEnv("NANOBANANA_CACHE_TTL_MS", 10 * 60 * 1000); // 10 minutes
const CACHE_MAX_ENTRIES = intEnv("NANOBANANA_CACHE_MAX_ENTRIES", 20);

export interface GenerationCacheValue {
  images: { data: string; mimeType: string }[];
  text?: string;
  modelVersion?: string;
  finishReason?: string;
}

export const generationCache = new TtlLruCache<GenerationCacheValue>(CACHE_MAX_ENTRIES, CACHE_TTL_MS);

/** Build a stable cache key from every input that affects the model's output. */
export function buildGenerationCacheKey(input: {
  modelId: string;
  prompt: string;
  referenceImages?: { data: string; mimeType: string }[];
  aspectRatio?: string;
  imageSize?: string;
  personGeneration?: string;
  thinkingLevel?: string;
  useSearchGrounding?: boolean;
}): string {
  const hash = createHash("sha256");
  hash.update(input.modelId);
  hash.update("\u0000");
  hash.update(input.prompt);
  hash.update("\u0000");
  hash.update(input.aspectRatio ?? "");
  hash.update("\u0000");
  hash.update(input.imageSize ?? "");
  hash.update("\u0000");
  hash.update(input.personGeneration ?? "");
  hash.update("\u0000");
  hash.update(input.thinkingLevel ?? "");
  hash.update("\u0000");
  hash.update(String(Boolean(input.useSearchGrounding)));
  for (const img of input.referenceImages ?? []) {
    hash.update("\u0000img:");
    hash.update(img.mimeType);
    hash.update(":");
    hash.update(img.data);
  }
  return hash.digest("hex");
}

export function tryGetCached(key: string): GenerationCacheValue | undefined {
  if (!CACHE_ENABLED) return undefined;
  const hit = generationCache.get(key);
  if (hit) logger.debug(`cache hit (${generationCache.size} entries cached)`);
  return hit;
}

export function storeInCache(key: string, value: GenerationCacheValue): void {
  if (!CACHE_ENABLED) return;
  generationCache.set(key, value);
}
