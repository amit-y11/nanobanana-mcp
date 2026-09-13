import type { McpServer } from "@modelcontextprotocol/server";
import type { AuthResolution } from "../auth.js";
import { CACHE_ENABLED, generationCache } from "../cache.js";

export function registerAuthStatusTool(server: McpServer, auth: AuthResolution): void {
  server.registerTool(
    "auth_status",
    {
      title: "Show server status",
      description:
        "Reports which credential source nanobanana-mcp is using (Gemini API key, Vertex AI Express " +
        "Mode API key, or Vertex AI / Gemini Enterprise Agent Platform ADC) without revealing secrets, " +
        "plus basic runtime info. Useful for debugging setup.",
    },
    async () => ({
      content: [
        {
          type: "text" as const,
          text: [
            `Auth mode: ${auth.mode}`,
            auth.summary,
            `Generation cache: ${CACHE_ENABLED ? `enabled (${generationCache.size} entries cached)` : "disabled"}`,
          ].join("\n"),
        },
      ],
    }),
  );
}
