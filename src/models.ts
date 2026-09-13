/**
 * Curated registry of Gemini image-generation ("Nano Banana") models.
 *
 * nanobanana-mcp ships three models. Unknown model ids/aliases are still
 * accepted and passed straight through to the API (see `resolveModel`), so
 * this file never blocks you from using a model Google ships after this
 * package was published — you just lose the curated description/capability
 * metadata and the auto-selection heuristic for that call.
 */

export interface ModelInfo {
  /** Canonical model id accepted by the Gemini API / Vertex AI. */
  id: string;
  /** Friendly, memorable aliases a user or agent might type instead of the id. */
  aliases: string[];
  displayName: string;
  description: string;
  /** Largest `image_size` this model accepts. */
  maxImageSize: "1K" | "2K" | "4K";
  supportsThinkingLevel: boolean;
  supportsSearchGrounding: boolean;
  /** Maximum number of reference images this model accepts for editing/composition. */
  maxReferenceImages: number;
  /** Whether the auto-selector is allowed to route to this model. */
  autoEligible: boolean;
}

export const MODELS: ModelInfo[] = [
  {
    id: "gemini-3.1-flash-image",
    aliases: ["nano-banana-2", "nanobanana-2", "nb2", "flash"],
    displayName: "Nano Banana 2 (Gemini 3.1 Flash Image)",
    description:
      "Default model. Generalist workhorse: up to 4K resolution at Flash speed, strong " +
      "text rendering, good multi-reference-image consistency, Google Search / Google " +
      "Image Search grounding. The right choice for most requests.",
    maxImageSize: "4K",
    supportsThinkingLevel: true,
    supportsSearchGrounding: true,
    maxReferenceImages: 10,
    autoEligible: true,
  },
  {
    id: "gemini-3-pro-image",
    aliases: ["nano-banana-pro", "nanobanana-pro", "pro"],
    displayName: "Nano Banana Pro (Gemini 3 Pro Image)",
    description:
      "Maximum reasoning depth for the most complex compositions: highest world " +
      "knowledge, advanced localization, accurate brand/text consistency, up to 4K. " +
      "Slower and more expensive than Nano Banana 2 — reserved for prompts that need it.",
    maxImageSize: "4K",
    supportsThinkingLevel: false,
    supportsSearchGrounding: true,
    maxReferenceImages: 14,
    autoEligible: true,
  },
  {
    id: "gemini-2.5-flash-image",
    aliases: ["nano-banana", "nanobanana", "legacy"],
    displayName: "Nano Banana (Gemini 2.5 Flash Image, legacy)",
    description:
      "Legacy Flash model, kept for high-volume rapid prototyping and for reproducing " +
      'results generated before Nano Banana 2 shipped. Not used by automatic model ' +
      'selection — request it explicitly (model: "legacy") when you want it.',
    maxImageSize: "1K",
    supportsThinkingLevel: false,
    supportsSearchGrounding: true,
    maxReferenceImages: 3,
    autoEligible: false,
  },
];

export const DEFAULT_MODEL_ID = "gemini-3.1-flash-image";

function findModel(key: string): ModelInfo | undefined {
  const k = key.toLowerCase();
  return MODELS.find((m) => m.id.toLowerCase() === k || m.aliases.some((a) => a.toLowerCase() === k));
}

function passThroughModel(requested: string): ModelInfo {
  return {
    id: requested,
    aliases: [],
    displayName: requested,
    description:
      "Custom or newly released model id (not in nanobanana-mcp's curated list) — passed through as-is.",
    maxImageSize: "4K",
    supportsThinkingLevel: true,
    supportsSearchGrounding: true,
    maxReferenceImages: 14,
    autoEligible: false,
  };
}

/**
 * Resolve a user-supplied model string to a {@link ModelInfo}. Does NOT
 * perform automatic selection — "auto" / undefined resolve to
 * `NANOBANANA_DEFAULT_MODEL` or {@link DEFAULT_MODEL_ID}. For prompt-aware
 * routing between Nano Banana 2 and Nano Banana Pro, see `chooseAutoModel`
 * in `auto-select.ts`, which calls this function once it has decided.
 */
export function resolveModel(input?: string): ModelInfo {
  const requested =
    (input && input.trim().toLowerCase() !== "auto" && input.trim()) ||
    process.env.NANOBANANA_DEFAULT_MODEL?.trim() ||
    DEFAULT_MODEL_ID;

  return findModel(requested) ?? passThroughModel(requested);
}

export function isAutoRequested(input?: string): boolean {
  return !input || input.trim().toLowerCase() === "auto";
}

export function formatModelList(): string {
  return MODELS.map((m) => {
    const caps = [
      `max ${m.maxImageSize}`,
      `up to ${m.maxReferenceImages} reference image${m.maxReferenceImages === 1 ? "" : "s"}`,
      m.supportsThinkingLevel ? "thinking_level" : undefined,
      m.supportsSearchGrounding ? "search grounding" : undefined,
      m.autoEligible ? "eligible for auto-selection" : "manual selection only",
    ].filter(Boolean);
    const aliasList = m.aliases.length ? m.aliases.join(", ") : "none";
    return `- ${m.id}\n  aliases: ${aliasList}\n  ${m.displayName} — ${m.description}\n  capabilities: ${caps.join(", ")}`;
  }).join("\n\n");
}
