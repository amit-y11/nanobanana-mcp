import { type ModelInfo, MODELS, resolveModel } from "./models.js";

/**
 * Smart model selection: when the caller doesn't pin a model, route between
 * Nano Banana 2 (fast, default) and Nano Banana Pro (deeper reasoning) based
 * on signals in the prompt. This is a transparent, explainable point-based
 * heuristic — not a model call — so it's instant, free, and its reasoning
 * can always be shown back to the caller.
 *
 * The legacy model is intentionally never chosen automatically; ask for it
 * by id/alias (e.g. `model: "legacy"`) when you specifically want it.
 */

const NB2 = MODELS.find((m) => m.id === "gemini-3.1-flash-image")!;
const PRO = MODELS.find((m) => m.id === "gemini-3-pro-image")!;

/**
 * Keyword matching uses a leading word-boundary (and, unless noted, a
 * trailing one too) so short keywords don't false-positive inside unrelated
 * words — plain substring matching would otherwise let "rough" fire on
 * "throughout" or "fast" fire on "breakfast". `typograph` is a deliberate
 * stem (matches both "typography" and "typographic"), so it skips the
 * trailing boundary.
 */
function wordPattern(phrase: string, opts: { trailingBoundary?: boolean } = {}): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const trailing = opts.trailingBoundary ?? true;
  // "s?" tolerates simple plurals ("diagram(s)", "logo(s)") without opening
  // the door to unrelated words the way a bare substring match would.
  return new RegExp(`\\b${escaped}${trailing ? "s?\\b" : ""}`);
}

interface KeywordPattern {
  label: string;
  regex: RegExp;
}

function patterns(words: string[]): KeywordPattern[] {
  return words.map((w) => ({ label: w, regex: wordPattern(w) }));
}

const PRO_SIGNAL_PATTERNS: KeywordPattern[] = [
  ...patterns([
    "logo",
    "infographic",
    "diagram",
    "chart",
    "poster",
    "magazine",
    "brand",
    "brochure",
    "advertisement",
    "ad campaign",
    "packaging",
    "multi-panel",
    "comic",
    "storyboard",
    "product mockup",
    "professional photograph",
    "precise text",
    "readable text",
    "book cover",
    "menu design",
    "blueprint",
    "schematic",
    "ui mockup",
    "wireframe",
    "flowchart",
    "dashboard",
    "map of",
    "consistent character",
    "character consistency",
    "brand consistency",
  ]),
  { label: "typograph", regex: wordPattern("typograph", { trailingBoundary: false }) },
];

const FAST_SIGNAL_PATTERNS: KeywordPattern[] = patterns([
  "quick",
  "quickly",
  "draft",
  "sketch",
  "rough",
  "simple",
  "fast",
  "prototype",
  "doodle",
  "throwaway",
]);

const PRO_THRESHOLD = 3;
const LONG_PROMPT_WORD_COUNT = 40;

export interface AutoSelection {
  model: ModelInfo;
  score: number;
  threshold: number;
  reasoning: string;
}

export interface AutoSelectParams {
  prompt: string;
  referenceImageCount?: number;
}

export function chooseAutoModel(params: AutoSelectParams): AutoSelection {
  const text = params.prompt.toLowerCase();
  const referenceImageCount = params.referenceImageCount ?? 0;
  let score = 0;
  const reasons: string[] = [];

  const wordCount = params.prompt.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > LONG_PROMPT_WORD_COUNT) {
    score += 2;
    reasons.push(`long, detailed prompt (${wordCount} words)`);
  }

  const matchedKeywords = PRO_SIGNAL_PATTERNS.filter((p) => p.regex.test(text));
  if (matchedKeywords.length > 0) {
    score += 2;
    reasons.push(`mentions ${matchedKeywords.slice(0, 3).map((p) => p.label).join(", ")}`);
  }

  const quotedText = params.prompt.match(/["“][^"”]{2,}["”]/g);
  if (quotedText && quotedText.length > 0) {
    score += 1;
    reasons.push("requires exact quoted text to be rendered");
  }

  if (referenceImageCount >= 4) {
    score += 1;
    reasons.push(`${referenceImageCount} reference images to reconcile`);
  }

  const fastMatches = FAST_SIGNAL_PATTERNS.filter((p) => p.regex.test(text));
  if (fastMatches.length > 0) {
    score -= 2;
    reasons.push(`prompt asks for something quick/rough ("${fastMatches[0].label}")`);
  }

  const useProModel = score >= PRO_THRESHOLD;
  const chosen = resolveModel(useProModel ? PRO.id : NB2.id);

  const reasoning = reasons.length
    ? `${useProModel ? "Nano Banana Pro" : "Nano Banana 2"} (score ${score}/${PRO_THRESHOLD}): ${reasons.join("; ")}.`
    : `${useProModel ? "Nano Banana Pro" : "Nano Banana 2"} (score ${score}/${PRO_THRESHOLD}): no strong complexity signals — defaulting to the faster model.`;

  return { model: chosen, score, threshold: PRO_THRESHOLD, reasoning };
}
