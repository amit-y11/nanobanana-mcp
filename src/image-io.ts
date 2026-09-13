import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export interface RawImage {
  data: string; // base64
  mimeType: string;
}

/** A reference image supplied by the caller: either a local file path or inline base64 data. */
export type ImageInput = { path: string } | { data: string; mime_type: string };

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export function extensionForMimeType(mimeType: string): string {
  return EXT_BY_MIME[mimeType.toLowerCase()] ?? ".png";
}

function mimeTypeForExtension(ext: string): string | undefined {
  return MIME_BY_EXT[ext.toLowerCase()];
}

/** Load a reference image supplied by the caller into base64 + mime type, reading from disk if needed. */
export async function loadReferenceImage(input: ImageInput): Promise<RawImage> {
  if ("path" in input) {
    const resolved = path.resolve(input.path);
    let buf: Buffer;
    try {
      buf = await fs.readFile(resolved);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Could not read reference image at "${resolved}": ${reason}`);
    }
    const mimeType = mimeTypeForExtension(path.extname(resolved)) ?? "image/png";
    return { data: buf.toString("base64"), mimeType };
  }
  return { data: input.data, mimeType: input.mime_type };
}

/** Default directory generated images are saved to when the caller doesn't give an explicit path. */
export function defaultOutputDir(): string {
  const configured = process.env.NANOBANANA_OUTPUT_DIR?.trim();
  return configured && configured.length > 0 ? configured : path.join(os.tmpdir(), "nanobanana-mcp");
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function generateFilename(mimeType: string, hint?: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = (hint && hint.trim().length > 0 ? hint.trim() : "nanobanana").replace(/[^a-zA-Z0-9-_]+/g, "_");
  return `${base}-${stamp}-${randomSuffix()}${extensionForMimeType(mimeType)}`;
}

export interface SaveImageOptions {
  /**
   * Absolute or relative path. If it looks like a directory (trailing slash,
   * or no extension), a generated filename is appended inside it. Relative
   * paths are resolved against {@link defaultOutputDir}, not process.cwd(),
   * so behavior is stable regardless of where the MCP client launched the
   * server process from.
   */
  outputPath?: string;
  filenameHint?: string;
}

/** Write base64 image data to disk, creating directories as needed, and return the absolute path written. */
export async function saveImage(data: string, mimeType: string, opts: SaveImageOptions): Promise<string> {
  const buffer = Buffer.from(data, "base64");
  let targetPath: string;

  if (opts.outputPath) {
    const base = path.isAbsolute(opts.outputPath) ? opts.outputPath : path.join(defaultOutputDir(), opts.outputPath);
    const looksLikeDirectory =
      opts.outputPath.endsWith("/") || opts.outputPath.endsWith(path.sep) || path.extname(base) === "";
    targetPath = looksLikeDirectory ? path.join(base, generateFilename(mimeType, opts.filenameHint)) : base;
  } else {
    targetPath = path.join(defaultOutputDir(), generateFilename(mimeType, opts.filenameHint));
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);
  return targetPath;
}
