import type { GenerateImageResult } from "./genai.js";
import { saveImage, defaultOutputDir } from "./image-io.js";
import { recordGeneratedImage } from "./manifest.js";
import { logger } from "./logger.js";

export function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(message);
  return {
    content: [{ type: "text" as const, text: `nanobanana-mcp error: ${message}` }],
    isError: true,
  };
}

export function shouldSave(explicit: boolean | undefined): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  return Boolean(process.env.NANOBANANA_OUTPUT_DIR?.trim());
}

export interface BuildResponseOptions {
  save: boolean;
  outputPath?: string;
  filenameHint: string;
  model: string;
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  autoSelected: boolean;
  selectionReason?: string;
  cached: boolean;
}

export async function buildToolResponse(result: GenerateImageResult, opts: BuildResponseOptions) {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  > = [];
  const savedPaths: string[] = [];

  for (const img of result.images) {
    content.push({ type: "image", data: img.data, mimeType: img.mimeType });
    if (opts.save) {
      try {
        const path = await saveImage(img.data, img.mimeType, {
          outputPath: opts.outputPath,
          filenameHint: opts.filenameHint,
        });
        savedPaths.push(path);
        recordGeneratedImage({
          path,
          model: opts.model,
          prompt: opts.prompt,
          mimeType: img.mimeType,
          aspectRatio: opts.aspectRatio,
          imageSize: opts.imageSize,
          sizeBytes: Buffer.byteLength(img.data, "base64"),
          autoSelected: opts.autoSelected,
          selectionReason: opts.selectionReason,
        });
      } catch (err) {
        logger.warn(`failed to save generated image to disk: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const summary: string[] = [];
  summary.push(
    `Generated ${result.images.length} image${result.images.length === 1 ? "" : "s"} with ${opts.model}` +
      (result.modelVersion ? ` (${result.modelVersion})` : "") +
      (opts.cached ? " — served from cache." : "."),
  );
  if (opts.autoSelected && opts.selectionReason) {
    summary.push(`Auto-selected model: ${opts.selectionReason}`);
  }
  if (result.text) {
    summary.push(`Model note: ${result.text}`);
  }
  if (savedPaths.length > 0) {
    summary.push(`Saved to:\n${savedPaths.map((p) => `  - ${p}`).join("\n")}`);
  } else if (opts.save) {
    summary.push(`(Requested to save, but writing to disk failed — see server logs. Default output dir: ${defaultOutputDir()})`);
  }

  content.unshift({ type: "text", text: summary.join("\n") });

  return { content };
}
