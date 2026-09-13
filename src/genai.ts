import type { GoogleGenAI } from "@google/genai";
import type { RawImage } from "./image-io.js";

/**
 * This wraps `ai.models.generateContent` (the stable, long-term-supported
 * Gemini API) rather than the newer `ai.interactions.create` Interactions
 * API. As of this writing the Interactions API is still in beta and its
 * Vertex AI / Gemini Enterprise Agent Platform support is unclear, while
 * `generateContent` is documented as fully supported and works identically
 * across the Gemini Developer API and Vertex AI — which matters a lot for a
 * server whose whole point is to support both backends transparently.
 */

export interface GenerateImageParams {
  client: GoogleGenAI;
  model: string;
  prompt: string;
  referenceImages?: RawImage[];
  aspectRatio?: string;
  imageSize?: string;
  personGeneration?: string;
  thinkingLevel?: "minimal" | "high";
  useSearchGrounding?: boolean;
}

export interface GenerateImageResult {
  images: RawImage[];
  text?: string;
  modelVersion?: string;
  finishReason?: string;
}

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const parts: Array<Record<string, unknown>> = [];

  for (const img of params.referenceImages ?? []) {
    parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
  }
  parts.push({ text: params.prompt });

  const imageConfig: Record<string, unknown> = {};
  if (params.aspectRatio) imageConfig.aspectRatio = params.aspectRatio;
  if (params.imageSize) imageConfig.imageSize = params.imageSize;
  if (params.personGeneration) imageConfig.personGeneration = params.personGeneration;

  const config: Record<string, unknown> = {
    // Explicitly requesting both modalities is required on some Nano Banana
    // model versions and harmless on the rest.
    responseModalities: ["TEXT", "IMAGE"],
  };
  if (Object.keys(imageConfig).length > 0) config.imageConfig = imageConfig;
  if (params.thinkingLevel) config.thinkingConfig = { thinkingLevel: params.thinkingLevel.toUpperCase() };
  if (params.useSearchGrounding) config.tools = [{ googleSearch: {} }];

  let response;
  try {
    response = await params.client.models.generateContent({
      model: params.model,
      contents: [{ role: "user", parts }],
      config,
    });
  } catch (err) {
    throw new Error(`Gemini API request failed: ${describeApiError(err)}`);
  }

  const candidate = response.candidates?.[0];
  if (!candidate) {
    const reason = response.promptFeedback?.blockReason;
    throw new Error(
      reason
        ? `The model returned no candidates (prompt blocked: ${reason}).`
        : "The model returned no candidates.",
    );
  }

  const images: RawImage[] = [];
  const textChunks: string[] = [];
  for (const part of candidate.content?.parts ?? []) {
    if (part.inlineData?.data) {
      images.push({ data: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" });
    } else if (part.text && !part.thought) {
      textChunks.push(part.text);
    }
  }

  if (images.length === 0) {
    const said = textChunks.join(" ").trim();
    throw new Error(
      `The model did not return an image (finishReason=${candidate.finishReason ?? "unknown"}).` +
        (said ? ` Model said: "${said.slice(0, 500)}"` : ""),
    );
  }

  return {
    images,
    text: textChunks.join("\n").trim() || undefined,
    modelVersion: response.modelVersion,
    finishReason: candidate.finishReason,
  };
}

function describeApiError(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as { status?: number; message?: string; toString?: () => string };
    if (anyErr.status && anyErr.message) return `HTTP ${anyErr.status} — ${anyErr.message}`;
    if (anyErr.message) return anyErr.message;
  }
  return String(err);
}
