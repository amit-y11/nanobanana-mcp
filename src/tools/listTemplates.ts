import type { McpServer } from "@modelcontextprotocol/server";
import { formatTemplateCatalog } from "../templates.js";

export function registerListTemplatesTool(server: McpServer): void {
  server.registerTool(
    "list_templates",
    {
      title: "List smart prompt templates",
      description:
        "Lists nanobanana-mcp's curated prompt templates for photography, design, and editing, with the " +
        "fields each one accepts. Pass a template id and its fields to render_template to get a " +
        "ready-to-use prompt, or call the same templates through the MCP prompts/list API.",
    },
    async () => ({
      content: [{ type: "text" as const, text: formatTemplateCatalog() }],
    }),
  );
}
