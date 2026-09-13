import type { McpServer } from "@modelcontextprotocol/server";
import { TEMPLATES, templateArgsSchema } from "./templates.js";

/**
 * Registers each smart template as a native MCP Prompt, so clients with a
 * prompt picker / slash-command UI (Claude Desktop, Claude Code) can invoke
 * "photo_realistic_scene", "logo_design", etc. directly, with argument
 * validation and autocompletion of field names from the schema.
 *
 * Clients that don't surface Prompts still get the same catalog through the
 * `list_templates` / `render_template` tools (see src/tools).
 */
export function registerPrompts(server: McpServer): void {
  for (const template of TEMPLATES) {
    server.registerPrompt(
      template.id,
      {
        title: template.title,
        description: `[${template.category}] ${template.description}`,
        argsSchema: templateArgsSchema(template),
      },
      (args) => ({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `${template.render(args as Record<string, string | undefined>)}\n\n` +
                "(Use the generate_image or edit_image tool with this text as the prompt.)",
            },
          },
        ],
      }),
    );
  }
}
