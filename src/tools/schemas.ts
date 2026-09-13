import { z } from "zod";

export const AspectRatioEnum = z.enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]);
export const ImageSizeEnum = z.enum(["512", "1K", "2K", "4K"]);
export const PersonGenerationEnum = z.enum(["ALLOW_ALL", "ALLOW_ADULT", "ALLOW_NONE"]);
export const ThinkingLevelEnum = z.enum(["minimal", "high"]);

export const ModelField = z
  .string()
  .optional()
  .describe(
    'Model id or alias. "auto" (default) smart-selects between Nano Banana 2 and Nano Banana Pro based on ' +
      "prompt complexity. Known aliases: nb2/nano-banana-2 (gemini-3.1-flash-image), pro/nano-banana-pro " +
      "(gemini-3-pro-image), legacy/nano-banana (gemini-2.5-flash-image, not auto-selected). Any other " +
      "Gemini image-capable model id is accepted and passed through as-is.",
  );

export const AspectRatioField = AspectRatioEnum.optional().describe(
  "Aspect ratio of the output image. Defaults to the model's default (usually 1:1) when omitted.",
);

export const ImageSizeField = ImageSizeEnum.optional().describe(
  '"4K" only on Nano Banana 2 / Nano Banana Pro. Defaults to 1K.',
);

export const PersonGenerationField = PersonGenerationEnum.optional().describe(
  "Controls generation of people in the image.",
);

export const ThinkingLevelField = ThinkingLevelEnum.optional().describe(
  '"high" improves complex prompts at the cost of latency. Only affects Nano Banana 2 (ignored otherwise).',
);

export const SearchGroundingField = z
  .boolean()
  .optional()
  .describe(
    "Ground the image in real-time Google Search results (e.g. current weather, sports scores, recent " +
      "events). Not supported on the legacy model.",
  );

export const SaveToFileField = z
  .boolean()
  .optional()
  .describe(
    "Also write the generated image(s) to disk (and make them browsable via the generated-image:// " +
      "resource). Defaults to true when NANOBANANA_OUTPUT_DIR is set, false otherwise.",
  );

export const OutputPathField = z
  .string()
  .optional()
  .describe(
    "File path or directory to save the image to. Relative paths resolve against NANOBANANA_OUTPUT_DIR " +
      "(or the system temp dir if unset), not the current working directory.",
  );
