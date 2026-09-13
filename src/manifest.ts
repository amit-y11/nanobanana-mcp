import { randomUUID } from "node:crypto";

/**
 * Session-scoped manifest of images nanobanana-mcp has saved to disk, so
 * they can be browsed as MCP resources (`generated-image://{id}` and
 * `generated-image://recent`) instead of only existing as one-off tool
 * results. Only images actually written to disk are tracked here — there's
 * nothing durable to browse for an inline-only (not saved) generation.
 *
 * This is an in-memory, best-effort index, not a database: it resets when
 * the server process restarts and is capped at MAX_RECORDS entries.
 */

export interface GeneratedImageRecord {
  id: string;
  path: string;
  model: string;
  prompt: string;
  mimeType: string;
  aspectRatio?: string;
  imageSize?: string;
  sizeBytes: number;
  autoSelected: boolean;
  selectionReason?: string;
  createdAt: string;
}

const MAX_RECORDS = 50;
const records: GeneratedImageRecord[] = [];

export function recordGeneratedImage(input: Omit<GeneratedImageRecord, "id" | "createdAt">): GeneratedImageRecord {
  const record: GeneratedImageRecord = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  records.unshift(record);
  while (records.length > MAX_RECORDS) records.pop();
  return record;
}

export function getGeneratedImage(id: string): GeneratedImageRecord | undefined {
  return records.find((r) => r.id === id);
}

export function listGeneratedImages(): GeneratedImageRecord[] {
  return records.slice();
}
