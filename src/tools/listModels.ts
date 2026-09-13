import type { McpServer } from "@modelcontextprotocol/server";
import { formatModelList } from "../models.js";

export function registerListModelsTool(server: McpServer): void {
  server.registerTool(
    "list_models",
    {
      title: "List Nano Banana models",
      description:
        "Returns the three supported Gemini image models, their aliases, and capabilities (max " +
        "resolution, thinking_level support, search grounding, reference-image limits, whether " +
        "automatic model selection can pick them).",
    },
    async () => ({
      content: [{ type: "text" as const, text: formatModelList() }],
    }),
  );
}
