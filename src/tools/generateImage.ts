import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { AuthResolution } from "../auth.js";
import { generateImage } from "../genai.js";
import { resolveModel, isAutoRequested } from "../models.js";
import { chooseAutoModel } from "../auto-select.js";
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

const GenerateImageInput = z.object({
  prompt: z
    .string()
    .min(1, "prompt must not be empty")
    .max(4000, "prompt is too long (max 4000 characters)")
    .describe(
      "Description of the image to generate. Be specific: subject, setting, style, lighting, camera " +
        "angle, and any exact text that must appear in the image.",
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

export function registerGenerateImageTool(server: McpServer, auth: AuthResolution): void {
  server.registerTool(
    "generate_image",
    {
      title: "Generate image (Nano Banana)",
      description:
        "Generate an image from a text prompt using Google's Gemini image models (the Nano Banana " +
        "family). By default, automatically picks Nano Banana 2 (fast) or Nano Banana Pro (deeper " +
        "reasoning) based on the prompt's complexity — pass an explicit `model` to override. Returns " +
        "the image inline and optionally saves it to disk.",
      inputSchema: GenerateImageInput,
    },
    async (args) => {
      try {
        const auto = isAutoRequested(args.model);
        const selection = auto ? chooseAutoModel({ prompt: args.prompt }) : undefined;
        const modelInfo = selection ? selection.model : resolveModel(args.model);

        const cacheKey = buildGenerationCacheKey({
          modelId: modelInfo.id,
          prompt: args.prompt,
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
          filenameHint: "generated",
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
