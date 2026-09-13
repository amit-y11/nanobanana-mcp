import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/server";
import { TEMPLATES, templateCatalogJson } from "./templates.js";
import { getGeneratedImage, listGeneratedImages } from "./manifest.js";

/**
 * "Resource Discovery" — browsable, read-only context alongside the Tools:
 *   - template://catalog             the whole prompt-template catalog as JSON
 *   - template://{category}/{id}     one template's detail (fields, description)
 *   - generated-image://recent       metadata for images saved to disk this session
 *   - generated-image://{id}         one generated image's metadata (+ content, if still on disk)
 */
export function registerResources(server: McpServer): void {
  server.registerResource(
    "template-catalog",
    "template://catalog",
    {
      title: "Prompt template catalog",
      description: "All curated photography/design/editing prompt templates, as JSON.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(templateCatalogJson(), null, 2),
        },
      ],
    }),
  );

  for (const template of TEMPLATES) {
    server.registerResource(
      `template-${template.id}`,
      `template://${template.category}/${template.id}`,
      {
        title: template.title,
        description: template.description,
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                id: template.id,
                category: template.category,
                title: template.title,
                description: template.description,
                fields: template.fields,
              },
              null,
              2,
            ),
          },
        ],
      }),
    );
  }

  server.registerResource(
    "generated-images-recent",
    "generated-image://recent",
    {
      title: "Recently generated images",
      description: "Metadata for images nanobanana-mcp has saved to disk this session (most recent first).",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(listGeneratedImages(), null, 2),
        },
      ],
    }),
  );

  const generatedImageTemplate = new ResourceTemplate("generated-image://{id}", {
    list: () => ({
      resources: listGeneratedImages().map((record) => ({
        uri: `generated-image://${record.id}`,
        name: record.id,
        title: record.prompt.slice(0, 80),
        description: `${record.model} — ${record.path}`,
        mimeType: "application/json",
      })),
    }),
  });

  server.registerResource(
    "generated-image",
    generatedImageTemplate,
    {
      title: "Generated image metadata",
      description: "Metadata (model, prompt, path, size) for one image nanobanana-mcp saved to disk.",
    },
    async (uri, variables) => {
      const id = Array.isArray(variables.id) ? variables.id[0] : variables.id;
      const record = id ? getGeneratedImage(id) : undefined;
      if (!record) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `No generated image found with id "${id}". It may have been generated in a previous server session (the manifest is in-memory only) or the id is wrong.`,
            },
          ],
        };
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(record, null, 2),
          },
        ],
      };
    },
  );
}
