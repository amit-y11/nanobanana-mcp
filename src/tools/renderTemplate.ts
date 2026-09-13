import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { findTemplate, TEMPLATES } from "../templates.js";
import { errorResult } from "../tool-helpers.js";

const RenderTemplateInput = z.object({
  template: z
    .string()
    .describe(`Template id. See list_templates for the full catalog. One of: ${TEMPLATES.map((t) => t.id).join(", ")}`),
  fields: z
    .record(z.string(), z.string())
    .optional()
    .describe("Values for the template's fields (see list_templates for each template's field names)."),
});

export function registerRenderTemplateTool(server: McpServer): void {
  server.registerTool(
    "render_template",
    {
      title: "Render a smart prompt template",
      description:
        "Fills a curated photography/design/editing template with your values and returns a ready-to-use " +
        "prompt. Feed the result straight into generate_image's or edit_image's `prompt` argument.",
      inputSchema: RenderTemplateInput,
    },
    async (args) => {
      try {
        const template = findTemplate(args.template);
        if (!template) {
          throw new Error(
            `Unknown template "${args.template}". Known templates: ${TEMPLATES.map((t) => t.id).join(", ")}.`,
          );
        }

        const fields = args.fields ?? {};
        const missing = template.fields.filter((f) => f.required && !fields[f.name]?.trim());
        if (missing.length > 0) {
          throw new Error(
            `Template "${template.id}" is missing required field(s): ${missing.map((f) => f.name).join(", ")}.`,
          );
        }

        const rendered = template.render(fields);
        return {
          content: [
            {
              type: "text" as const,
              text: `${rendered}\n\n(rendered from template "${template.id}")`,
            },
          ],
        };
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
