import { GoogleGenAI } from "@google/genai";

/**
 * The three credential paths nanobanana-mcp supports:
 *
 *  - "gemini-api-key"        Gemini Developer API key from https://aistudio.google.com/apikey
 *  - "vertex-express-api-key" Vertex AI / Gemini Enterprise Agent Platform "Express Mode" API key
 *                             (no GCP project required)
 *  - "vertex-adc"             Vertex AI / Gemini Enterprise Agent Platform with a real GCP project,
 *                             authenticated via Application Default Credentials (a service account
 *                             JSON file, `gcloud auth application-default login`, or the metadata
 *                             server when running on GCP compute)
 */
export type AuthMode = "gemini-api-key" | "vertex-express-api-key" | "vertex-adc";

export interface AuthResolution {
  client: GoogleGenAI;
  mode: AuthMode;
  /** Human-readable, secret-free description of the active credential, for logs and the auth_status tool. */
  summary: string;
}

export class AuthConfigError extends Error {}

function truthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function mask(secret: string): string {
  if (secret.length <= 8) return "*".repeat(secret.length);
  return `${secret.slice(0, 4)}...${secret.slice(-4)} (${secret.length} chars)`;
}

interface EnvSnapshot {
  forcedMode?: string;
  useVertex: boolean;
  geminiApiKey?: string;
  vertexApiKey?: string;
  project?: string;
  location?: string;
  adcPath?: string;
}

function readEnv(): EnvSnapshot {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  // VERTEX_API_KEY is a nanobanana-mcp-specific alias so both keys can be
  // configured side by side without one silently overriding the other.
  const vertexApiKey = process.env.VERTEX_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();

  return {
    forcedMode: process.env.NANOBANANA_AUTH_MODE?.trim().toLowerCase(),
    useVertex:
      truthy(process.env.GOOGLE_GENAI_USE_VERTEXAI) ||
      truthy(process.env.GOOGLE_GENAI_USE_ENTERPRISE),
    geminiApiKey,
    vertexApiKey,
    project: process.env.GOOGLE_CLOUD_PROJECT?.trim() || process.env.GCLOUD_PROJECT?.trim(),
    location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || process.env.GOOGLE_CLOUD_REGION?.trim(),
    adcPath: process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  };
}

function vertexAdcResolution(project: string, location: string | undefined, adcPath: string | undefined): AuthResolution {
  const loc = location || "global";
  return {
    client: new GoogleGenAI({ vertexai: true, project, location: loc }),
    mode: "vertex-adc",
    summary:
      `Vertex AI / Gemini Enterprise Agent Platform (ADC) — project=${project}, location=${loc}, ` +
      (adcPath
        ? `credentials=service account file (${adcPath})`
        : "credentials=gcloud user ADC or GCP metadata server"),
  };
}

function vertexExpressResolution(apiKey: string): AuthResolution {
  return {
    client: new GoogleGenAI({ vertexai: true, apiKey }),
    mode: "vertex-express-api-key",
    summary: `Vertex AI / Gemini Enterprise Agent Platform (Express Mode) — key ${mask(apiKey)}`,
  };
}

function geminiResolution(apiKey: string): AuthResolution {
  return {
    client: new GoogleGenAI({ apiKey }),
    mode: "gemini-api-key",
    summary: `Gemini Developer API (AI Studio) — key ${mask(apiKey)}`,
  };
}

const CONFIG_HELP =
  "Configure exactly one of the following (see README.md):\n" +
  "  1. Gemini Developer API:        GEMINI_API_KEY=<key from https://aistudio.google.com/apikey>\n" +
  "  2. Vertex AI Express Mode:      GOOGLE_GENAI_USE_VERTEXAI=true and VERTEX_API_KEY=<express-mode key>\n" +
  "  3. Vertex AI with ADC:          GOOGLE_GENAI_USE_VERTEXAI=true, GOOGLE_CLOUD_PROJECT=<project-id>,\n" +
  "                                  GOOGLE_CLOUD_LOCATION=<region>, and ADC available\n" +
  "                                  (GOOGLE_APPLICATION_CREDENTIALS, `gcloud auth application-default login`,\n" +
  "                                  or a GCP-attached service account).";

/**
 * Resolve credentials from environment variables into a ready-to-use
 * {@link GoogleGenAI} client. Throws {@link AuthConfigError} with an
 * actionable message if configuration is missing or contradictory.
 *
 * `NANOBANANA_AUTH_MODE` (values: `gemini`, `vertex-express`, `vertex-adc`)
 * forces a specific mode and gives a precise error if that mode's variables
 * are incomplete, instead of silently falling through to another mode.
 */
export function resolveAuth(): AuthResolution {
  const env = readEnv();

  if (env.forcedMode) {
    switch (env.forcedMode) {
      case "gemini": {
        if (!env.geminiApiKey) {
          throw new AuthConfigError(
            `NANOBANANA_AUTH_MODE=gemini requires GEMINI_API_KEY (or GOOGLE_API_KEY).\n${CONFIG_HELP}`,
          );
        }
        return geminiResolution(env.geminiApiKey);
      }
      case "vertex-express":
      case "vertex-express-api-key": {
        if (!env.vertexApiKey) {
          throw new AuthConfigError(
            `NANOBANANA_AUTH_MODE=vertex-express requires VERTEX_API_KEY (or GOOGLE_API_KEY).\n${CONFIG_HELP}`,
          );
        }
        return vertexExpressResolution(env.vertexApiKey);
      }
      case "vertex-adc":
      case "vertex": {
        if (!env.project) {
          throw new AuthConfigError(
            `NANOBANANA_AUTH_MODE=vertex-adc requires GOOGLE_CLOUD_PROJECT (GOOGLE_CLOUD_LOCATION recommended).\n${CONFIG_HELP}`,
          );
        }
        return vertexAdcResolution(env.project, env.location, env.adcPath);
      }
      default:
        throw new AuthConfigError(
          `Unrecognized NANOBANANA_AUTH_MODE=\"${env.forcedMode}\". Use "gemini", "vertex-express", or "vertex-adc".`,
        );
    }
  }

  // Auto-detect, mirroring the precedence the underlying @google/genai SDK
  // itself uses when no explicit options are passed to `new GoogleGenAI()`.
  if (env.useVertex) {
    if (env.project) {
      return vertexAdcResolution(env.project, env.location, env.adcPath);
    }
    if (env.vertexApiKey) {
      return vertexExpressResolution(env.vertexApiKey);
    }
    throw new AuthConfigError(
      "GOOGLE_GENAI_USE_VERTEXAI is set, but neither GOOGLE_CLOUD_PROJECT (for ADC) nor " +
        `VERTEX_API_KEY/GOOGLE_API_KEY (for Express Mode) is set.\n${CONFIG_HELP}`,
    );
  }

  if (env.geminiApiKey) {
    return geminiResolution(env.geminiApiKey);
  }

  throw new AuthConfigError(`No credentials found.\n${CONFIG_HELP}`);
}
