#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

import { resolveAuth, AuthConfigError } from "./auth.js";
import { logger } from "./logger.js";
import { registerGenerateImageTool } from "./tools/generateImage.js";
import { registerEditImageTool } from "./tools/editImage.js";
import { registerListModelsTool } from "./tools/listModels.js";
import { registerAuthStatusTool } from "./tools/authStatus.js";
import { registerListTemplatesTool } from "./tools/listTemplates.js";
import { registerRenderTemplateTool } from "./tools/renderTemplate.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";
import { onGeneratedImageAdded } from "./manifest.js";

const SERVER_NAME = "nanobanana-mcp";
const SERVER_VERSION = "0.1.0";

// Never let an unexpected error write to stdout or silently kill the
// process without a trace — both would either corrupt the JSON-RPC stream
// or leave the client wondering why the server vanished.
process.on("uncaughtException", (err) => {
  logger.error("uncaught exception", err);
});
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled rejection", reason);
});

async function main(): Promise<void> {
  let auth;
  try {
    auth = resolveAuth();
  } catch (err) {
    if (err instanceof AuthConfigError) {
      logger.error(`configuration error: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  logger.info(`starting v${SERVER_VERSION} — ${auth.summary}`);

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  registerGenerateImageTool(server, auth);
  registerEditImageTool(server, auth);
  registerListModelsTool(server);
  registerAuthStatusTool(server, auth);
  registerListTemplatesTool(server);
  registerRenderTemplateTool(server);
  registerResources(server);
  registerPrompts(server);

  // Keep the `resources: { listChanged: true }` capability we declare on
  // initialize honest: tell already-connected clients to re-fetch
  // resources/list whenever a new generated-image record appears, instead
  // of only reflecting it the next time they happen to ask.
  onGeneratedImageAdded(() => {
    server.sendResourceListChanged();
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("connected on stdio, ready for requests");
}

main().catch((err) => {
  logger.error("fatal error during startup", err);
  process.exitCode = 1;
});
