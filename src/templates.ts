import { z } from "zod";

/**
 * Curated prompt templates, adapted from Google's own Gemini image-prompting
 * guide. Each template is exposed three ways so every kind of MCP client can
 * use it:
 *   - as an MCP Prompt (`prompts/list` / `prompts/get`) for clients with a
 *     slash-command / prompt-picker UI (e.g. Claude Desktop, Claude Code),
 *   - as a browsable MCP Resource (`template://{category}/{id}`) for clients
 *     that only support passive resource discovery,
 *   - through the `list_templates` / `render_template` tools, for clients
 *     and agents that only drive the server through Tools.
 */

export type TemplateCategory = "photography" | "design" | "editing";

export interface TemplateField {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface Template {
  id: string;
  category: TemplateCategory;
  title: string;
  description: string;
  fields: TemplateField[];
  render: (args: Record<string, string | undefined>) => string;
}

function field(name: string, description: string, opts: { required?: boolean; default?: string } = {}): TemplateField {
  return { name, description, required: opts.required ?? true, default: opts.default };
}

function fill(value: string | undefined, fallback: string): string {
  const v = value?.trim();
  return v && v.length > 0 ? v : fallback;
}

export const TEMPLATES: Template[] = [
  // ---------------------------------------------------------------- photography
  {
    id: "photo_realistic_scene",
    category: "photography",
    title: "Photorealistic scene",
    description: "A richly detailed photorealistic shot, following Gemini's photography prompting template.",
    fields: [
      field("subject", "The main subject of the photo"),
      field("setting", "Where the scene takes place"),
      field("shot_type", "Type of shot", { required: false, default: "wide-angle shot" }),
      field("lighting", "Description of the light", { required: false, default: "Soft, natural light" }),
      field("camera_angle", "Camera angle", { required: false, default: "eye level" }),
      field("lens_type", "Lens type", { required: false, default: "35mm lens" }),
    ],
    render: (a) =>
      `A photorealistic ${fill(a.shot_type, "wide-angle shot")} of a ${a.subject} in a ${a.setting}. ` +
      `${fill(a.lighting, "Soft, natural light")}. Shot from a ${fill(a.camera_angle, "eye level")} ` +
      `with a ${fill(a.lens_type, "35mm lens")}.`,
  },
  {
    id: "product_mockup",
    category: "photography",
    title: "Product mockup / commercial photography",
    description: "A clean, professional studio product shot for ecommerce, advertising, or branding.",
    fields: [
      field("product", "The product to photograph"),
      field("surface", "Background surface", { required: false, default: "a polished concrete surface" }),
      field("lighting_setup", "Lighting setup", { required: false, default: "a three-point softbox setup" }),
      field("lighting_purpose", "What the lighting should achieve", {
        required: false,
        default: "create soft, diffused highlights and eliminate harsh shadows",
      }),
      field("angle", "Camera angle", { required: false, default: "slightly elevated 45-degree shot" }),
      field("feature", "The feature the angle should showcase", { required: false, default: "its clean lines" }),
      field("detail", "The detail sharp focus should land on", { required: false, default: "the product's texture" }),
    ],
    render: (a) =>
      `A high-resolution, studio-lit product photograph of a ${a.product}, presented on ${fill(a.surface, "a polished concrete surface")}. ` +
      `The lighting is ${fill(a.lighting_setup, "a three-point softbox setup")} designed to ${fill(a.lighting_purpose, "create soft, diffused highlights and eliminate harsh shadows")}. ` +
      `The camera angle is a ${fill(a.angle, "slightly elevated 45-degree shot")} to showcase ${fill(a.feature, "its clean lines")}. ` +
      `Ultra-realistic, with sharp focus on ${fill(a.detail, "the product's texture")}.`,
  },

  // --------------------------------------------------------------------- design
  {
    id: "logo_design",
    category: "design",
    title: "Logo design",
    description: "A modern logo with specific rendered text — Nano Banana's strong text rendering does the heavy lifting.",
    fields: [
      field("brand", "Brand or company name"),
      field("text", "Exact text to render in the logo"),
      field("font_style", "Font style", { required: false, default: "clean, bold, sans-serif" }),
      field("style_description", "Overall style", { required: false, default: "modern and minimalist" }),
      field("color_scheme", "Color scheme", { required: false, default: "black and white" }),
    ],
    render: (a) =>
      `Create a ${fill(a.style_description, "modern and minimalist")} logo for ${a.brand} with the text "${a.text}" ` +
      `in a ${fill(a.font_style, "clean, bold, sans-serif")} font. The color scheme is ${fill(a.color_scheme, "black and white")}.`,
  },
  {
    id: "sticker_illustration",
    category: "design",
    title: "Stylized sticker / illustration",
    description: "A bold, clean die-cut-style sticker illustration.",
    fields: [
      field("subject", "The subject of the sticker"),
      field("activity", "What the subject is doing", { required: false, default: "" }),
      field("style", "Illustration style", { required: false, default: "kawaii-style" }),
      field("visual_qualities", "Visual qualities", {
        required: false,
        default: "bold, clean outlines, simple cel-shading, and a vibrant color palette",
      }),
      field("background", "Background", { required: false, default: "The background must be white" }),
    ],
    render: (a) => {
      const activity = a.activity?.trim() ? ` ${a.activity.trim()}.` : "";
      return (
        `A ${fill(a.style, "kawaii-style")} sticker of a ${a.subject}.${activity} ` +
        `The design features ${fill(a.visual_qualities, "bold, clean outlines, simple cel-shading, and a vibrant color palette")}. ` +
        `${fill(a.background, "The background must be white")}.`
      );
    },
  },
  {
    id: "infographic",
    category: "design",
    title: "Infographic",
    description: "An explanatory infographic that turns a topic into an easy-to-follow visual.",
    fields: [
      field("topic", "The topic to explain"),
      field("analogy", "An analogy to frame it as", { required: false, default: "a simple step-by-step recipe" }),
      field("key_points", "The key points that must appear"),
      field("visual_style", "Visual style", { required: false, default: "a colorful, modern editorial style" }),
      field("audience", "Target audience", { required: false, default: "a general audience" }),
    ],
    render: (a) =>
      `Create a vibrant infographic that explains ${a.topic} as if it were ${fill(a.analogy, "a simple step-by-step recipe")}. ` +
      `Show ${a.key_points}. The style should be ${fill(a.visual_style, "a colorful, modern editorial style")}, suitable for ${fill(a.audience, "a general audience")}.`,
  },
  {
    id: "minimalist_negative_space",
    category: "design",
    title: "Minimalist / negative-space design",
    description: "A minimal composition with room for overlaid text — good for website heroes, slides, and covers.",
    fields: [
      field("subject", "The single subject to feature"),
      field("position", "Where in the frame it sits", { required: false, default: "bottom-right" }),
      field("color", "Background color", { required: false, default: "off-white" }),
      field("lighting", "Lighting", { required: false, default: "Soft, diffused lighting from the top left" }),
    ],
    render: (a) =>
      `A minimalist composition featuring a single ${a.subject} positioned in the ${fill(a.position, "bottom-right")} of the frame. ` +
      `The background is a vast, empty ${fill(a.color, "off-white")} canvas, creating significant negative space. ${fill(a.lighting, "Soft, diffused lighting from the top left")}.`,
  },

  // ------------------------------------------------------------------- editing
  {
    id: "add_remove_element",
    category: "editing",
    title: "Add / remove / modify an element",
    description: "Edit a provided image by adding, removing, or changing one element while matching its style.",
    fields: [
      field("subject", "What the provided image is of"),
      field("action", "add, remove, or modify", { required: false, default: "add" }),
      field("element", "The element to change"),
      field("integration_description", "How the change should blend in", {
        required: false,
        default: "it matches the original photo's style, lighting, and perspective",
      }),
    ],
    render: (a) =>
      `Using the provided image of ${a.subject}, please ${fill(a.action, "add")} ${a.element} to the scene. ` +
      `Ensure the change is integrated so that ${fill(a.integration_description, "it matches the original photo's style, lighting, and perspective")}.`,
  },
  {
    id: "inpaint_replace",
    category: "editing",
    title: "Inpaint / replace one element",
    description: "Change exactly one element of a provided image (a semantic mask) while leaving everything else untouched.",
    fields: [field("element", "The element to change"), field("replacement", "What to change it to")],
    render: (a) =>
      `Using the provided image, change only the ${a.element} to ${a.replacement}. ` +
      `Keep everything else in the image exactly the same, preserving the original style, lighting, and composition.`,
  },
  {
    id: "style_transfer",
    category: "editing",
    title: "Style transfer",
    description: "Recreate a provided photo's content in a different artistic style while preserving composition.",
    fields: [
      field("subject", "What the provided photo is of"),
      field("style", "Target artistic style"),
      field("stylistic_elements", "Specific stylistic elements to apply", {
        required: false,
        default: "brushwork, color palette, and texture characteristic of that style",
      }),
    ],
    render: (a) =>
      `Transform the provided photograph of ${a.subject} into the artistic style of ${a.style}. ` +
      `Preserve the original composition, but render it with ${fill(a.stylistic_elements, "brushwork, color palette, and texture characteristic of that style")}.`,
  },
  {
    id: "combine_images",
    category: "editing",
    title: "Combine multiple images",
    description: "Composite elements from several reference images into one new scene.",
    fields: [
      field("element_a", "The element to take from the first image"),
      field("element_b", "The element/subject from the second image to combine it with"),
      field("final_scene", "Description of the final composited scene"),
    ],
    render: (a) =>
      `Create a new image by combining the elements from the provided images. Take the ${a.element_a} ` +
      `and place it with the ${a.element_b}. The final image should be ${a.final_scene}.`,
  },
];

export function findTemplate(id: string): Template | undefined {
  const key = id.trim().toLowerCase();
  return TEMPLATES.find((t) => t.id.toLowerCase() === key);
}

/** Build a Zod object schema for a template's fields (used by MCP prompt registration). */
export function templateArgsSchema(template: Template) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of template.fields) {
    const base = z.string().describe(f.description + (f.default ? ` (default: "${f.default}")` : ""));
    shape[f.name] = f.required ? base : base.optional();
  }
  return z.object(shape);
}

export function formatTemplateCatalog(): string {
  const byCategory = new Map<TemplateCategory, Template[]>();
  for (const t of TEMPLATES) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }
  const sections: string[] = [];
  for (const [category, templates] of byCategory) {
    const lines = templates.map((t) => {
      const fieldsDesc = t.fields
        .map((f) => `${f.name}${f.required ? "" : ` (optional, default: "${f.default ?? ""}")`}`)
        .join(", ");
      return `  - ${t.id}: ${t.title} — ${t.description}\n    fields: ${fieldsDesc}`;
    });
    sections.push(`${category}:\n${lines.join("\n")}`);
  }
  return sections.join("\n\n");
}

export function templateCatalogJson(): unknown {
  return TEMPLATES.map((t) => ({
    id: t.id,
    category: t.category,
    title: t.title,
    description: t.description,
    fields: t.fields,
  }));
}
