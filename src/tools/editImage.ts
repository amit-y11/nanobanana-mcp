import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { AuthResolution } from "../auth.js";
import { generateImage } from "../genai.js";
import { resolveModel, isAutoRequested } from "../models.js";
import { chooseAutoModel } from "../auto-select.js";
import { loadReferenceImage, type ImageInput } from "../image-io.js";
import { buildGenerationCacheKey, tryGetCached, storeInCache } from "../cache.js";
import { buildToolResponse, errorResult, shouldSave } from "../tool-helpers.js";
import {
  ModelField,
  AspectRatioField,
  ImageSizeField,
  PersonGenerationField,
  ThinkingLevelField,
  SearchGroundingField,
  SaveToFileField,
  OutputPathField,
} from "./schemas.js";

const ImageInputSchema = z.union([
  z.object({ path: z.string().min(1).describe("Absolute or relative local file path to an image.") }),
  z.object({
    data: z.string().min(1).describe("Base64-encoded image bytes."),
    mime_type: z.string().min(1).describe("MIME type of the image, e.g. image/png, image/jpeg, image/webp."),
  }),
]);

const EditImageInput = z.object({
  prompt: z
    .string()
    .min(1, "prompt must not be empty")
    .max(4000, "prompt is too long (max 4000 characters)")
    .describe(
      "Editing instructions: what to add, remove, or change, or how to combine the provided image(s). " +
        "Describe the desired result, not the mechanics of the edit.",
    ),
  images: z
    .array(ImageInputSchema)
    .min(1, "at least one reference image is required")
    .max(14, "at most 14 reference images are supported")
    .describe(
      "1-14 reference images, each as either a local file path or inline base64 data. Order matters " +
        'when the prompt refers to "the first image" / "the second image".',
    ),
  model: ModelField,
  aspect_ratio: AspectRatioField,
  image_size: ImageSizeField,
  person_generation: PersonGenerationField,
  thinking_level: ThinkingLevelField,
  use_search_grounding: SearchGroundingField,
  save_to_file: SaveToFileField,
  output_path: OutputPathField,
});

export function registerEditImageTool(server: McpServer, auth: AuthResolution): void {
  server.registerTool(
    "edit_image",
    {
      title: "Edit / compose image (Nano Banana)",
      description:
        "Edit, inpaint, restyle, or compose one or more reference images using Gemini's Nano Banana " +
        "models. Accepts local file paths or inline base64 image data. By default, automatically picks " +
        "Nano Banana 2 or Nano Banana Pro based on prompt complexity and reference-image count.",
      inputSchema: EditImageInput,
    },
    async (args) => {
      try {
        const auto = isAutoRequested(args.model);
        const selection = auto
          ? chooseAutoModel({ prompt: args.prompt, referenceImageCount: args.images.length })
          : undefined;
        const modelInfo = selection ? selection.model : resolveModel(args.model);

        if (args.images.length > modelInfo.maxReferenceImages) {
          throw new Error(
            `${modelInfo.displayName} accepts at most ${modelInfo.maxReferenceImages} reference image(s), ` +
              `but ${args.images.length} were provided. Use fewer images or pick a different model.`,
          );
        }

        const referenceImages = await Promise.all(args.images.map((img) => loadReferenceImage(img as ImageInput)));

        const cacheKey = buildGenerationCacheKey({
          modelId: modelInfo.id,
          prompt: args.prompt,
          referenceImages,
          aspectRatio: args.aspect_ratio,
          imageSize: args.image_size,
          personGeneration: args.person_generation,
          thinkingLevel: args.thinking_level,
          useSearchGrounding: args.use_search_grounding,
        });

        let cached = true;
        let result = tryGetCached(cacheKey);
        if (!result) {
          cached = false;
          result = await generateImage({
            client: auth.client,
            model: modelInfo.id,
            prompt: args.prompt,
            referenceImages,
            aspectRatio: args.aspect_ratio,
            imageSize: args.image_size,
            personGeneration: args.person_generation,
            thinkingLevel: args.thinking_level,
            useSearchGrounding: args.use_search_grounding,
          });
          storeInCache(cacheKey, result);
        }

        return await buildToolResponse(result, {
          save: shouldSave(args.save_to_file),
          outputPath: args.output_path,
          filenameHint: "edited",
          model: modelInfo.id,
          prompt: args.prompt,
          aspectRatio: args.aspect_ratio,
          imageSize: args.image_size,
          autoSelected: auto,
          selectionReason: selection?.reasoning,
          cached,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
