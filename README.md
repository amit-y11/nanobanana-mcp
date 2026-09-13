# nanobanana-mcp

An [MCP](https://modelcontextprotocol.io) server for Google's Gemini image models — the **"Nano Banana"** family. It exposes image generation, image editing/composition, and a curated set of prompt templates as MCP tools, prompts, and resources, and works with **any** of Gemini's three credential paths.

> **Note on naming:** Vertex AI was rebranded to the **Gemini Enterprise Agent Platform** in April 2026. The underlying APIs and credentials are unchanged — this README uses "Vertex AI" and "Agent Platform" interchangeably.

## Features

- 🎨 **Multi-Model AI Image Generation** — three Gemini models with intelligent automatic selection
  - 🍌 **Gemini 3.1 Flash Image (Nano Banana 2)** — default model: up to 4K resolution at Flash speed, with Google Search grounding
  - 🏆 **Gemini 3 Pro Image (Nano Banana Pro)** — maximum reasoning depth for the most complex compositions
  - ⚡ **Gemini 2.5 Flash Image (legacy)** — the original Flash model, for high-volume rapid prototyping
- 🤖 **Smart Model Selection** — when you don't pin a model, a transparent, explainable heuristic routes each prompt to Nano Banana 2 or Nano Banana Pro (never the legacy model) based on prompt complexity, and tells you why
- 📐 **Aspect Ratio & Resolution Control** — `1:1`, `16:9`, `9:16`, `21:9`, and 7 more, plus `512`/`1K`/`2K`/`4K` output sizes
- 📋 **Smart Templates** — 10 curated prompt templates for photography, design, and editing, available as native MCP Prompts *and* as plain tools for clients without a prompt-picker UI
- 🔍 **Resource Discovery** — browse the template catalog and metadata for every image you've saved to disk through MCP Resources
- 🖼️ **Image Editing & Composition** — up to 14 reference images, by local file path or inline base64
- 🔑 **Three Auth Modes** — Gemini API key, Vertex AI Express Mode API key, or full ADC — auto-detected from environment variables
- 🛡️ **Production Ready** — every tool call is wrapped in structured error handling; all logging goes to stderr (stdout is reserved for the JSON-RPC wire); startup fails fast with an actionable message if credentials are missing or contradictory
- ⚡ **High Performance** — a TTL/LRU response cache serves identical repeated requests (retries, accidental duplicates) from memory instead of re-billing the API

## Requirements

- Node.js **20+**
- One of: a [Gemini API key](https://aistudio.google.com/apikey), a Vertex AI Express Mode API key, or a Google Cloud project with Application Default Credentials

## Installation

**From npm (recommended)** — no local install step needed. Every client config below uses `npx -y @amit-y11/nanobanana-mcp`, which downloads and runs the latest published version on demand.

**From source** — for local development or before the package is published:

```bash
git clone https://github.com/amit-y11/nanobanana-mcp.git
cd nanobanana-mcp
npm install
npm run build
```

This produces `build/index.js`, a self-contained stdio MCP server. If you're running from source, swap `"command": "npx", "args": ["-y", "nanobanana-mcp"]` in every config below for `"command": "node", "args": ["/ABSOLUTE/PATH/TO/nanobanana-mcp/build/index.js"]`.

## Authentication

Pick **one** of the three modes. `nanobanana-mcp` auto-detects which one you've configured; set `NANOBANANA_AUTH_MODE` to force a specific mode and get a precise error if it's misconfigured, instead of silently falling through to another mode.

| Mode | Env vars | Notes |
| --- | --- | --- |
| **1. Gemini Developer API** | `GEMINI_API_KEY` | Simplest option. Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). |
| **2. Vertex AI Express Mode** | `GOOGLE_GENAI_USE_VERTEXAI=true`<br>`VERTEX_API_KEY` | An API key that talks to Vertex AI / Agent Platform without a full GCP project. |
| **3. Vertex AI with ADC** | `GOOGLE_GENAI_USE_VERTEXAI=true`<br>`GOOGLE_CLOUD_PROJECT`<br>`GOOGLE_CLOUD_LOCATION` | Needs a real GCP project. Credentials come from `GOOGLE_APPLICATION_CREDENTIALS` (a service account JSON key), `gcloud auth application-default login`, or an attached service account when running on GCP compute — whichever is available. |

`GOOGLE_API_KEY` is also accepted as a fallback for either key-based mode (matching the underlying Google SDK's own conventions); `VERTEX_API_KEY` exists so you can keep a Gemini key and a Vertex key configured side by side without one silently shadowing the other.

Call the `auth_status` tool at any time to see which mode is active (secrets are masked).

See [`.env.example`](./.env.example) for the full list of variables, including optional ones (default model, output directory, log level, cache settings).

## Available tools

| Tool | Purpose |
| --- | --- |
| `generate_image` | Text-to-image generation. |
| `edit_image` | Edit, inpaint, restyle, or compose 1–14 reference images (file path or base64). |
| `list_models` | The 3 supported models, their aliases, and capabilities. |
| `list_templates` | The prompt-template catalog (see below). |
| `render_template` | Fill a template's fields and get back a ready-to-use prompt. |
| `auth_status` | Which credential mode is active, and cache stats. |

Both `generate_image` and `edit_image` accept: `model` (id, alias, or `"auto"`), `aspect_ratio`, `image_size`, `person_generation`, `thinking_level`, `use_search_grounding`, `save_to_file`, `output_path`.

### Smart model selection

Leave `model` unset (or pass `"auto"`) and the server scores the prompt — length, design/text-rendering keywords ("logo", "infographic", "poster", quoted text to render, reference-image count) against "make it quick/rough/simple" signals — and routes to **Nano Banana 2** or **Nano Banana Pro** accordingly. The response always states which model was picked and why, e.g.:

> Auto-selected model: Nano Banana Pro (score 3/3): mentions logo; requires exact quoted text to be rendered.

The legacy model is never auto-selected — ask for it explicitly (`model: "legacy"`) when you specifically want it.

### Prompt templates

Ten templates, adapted from Google's own Gemini prompting guide, across three categories:

- **Photography** — `photo_realistic_scene`, `product_mockup`
- **Design** — `logo_design`, `sticker_illustration`, `infographic`, `minimalist_negative_space`
- **Editing** — `add_remove_element`, `inpaint_replace`, `style_transfer`, `combine_images`

They're available three ways, so every client can use them:

1. **MCP Prompts** (`prompts/list` / `prompts/get`) — Claude Desktop and Claude Code show these in their prompt picker / slash-command menu with full argument validation.
2. **Resources** — `template://catalog` (the whole catalog as JSON) and `template://{category}/{id}` per template, for clients that only browse resources.
3. **Tools** — `list_templates` to browse, `render_template` to fill one in and get back a prompt string to feed into `generate_image`/`edit_image`. This path works in any MCP client, including ones without prompt or resource UI.

### Resources

| URI | Contents |
| --- | --- |
| `template://catalog` | All templates, as JSON. |
| `template://{category}/{id}` | One template's fields and description. |
| `generated-image://recent` | Metadata for images saved to disk this session (most recent first). |
| `generated-image://{id}` | One saved image's model, prompt, path, size, and whether it was auto-selected. |

The `generated-image://*` resources only cover images actually written to disk (see `save_to_file` / `NANOBANANA_OUTPUT_DIR` below) — there's nothing durable to browse for an inline-only result, and the manifest itself is in-memory and resets when the server restarts.

### Saving images to disk

By default, generated images are returned inline (base64) and **not** written to disk. To save them:

- Set `NANOBANANA_OUTPUT_DIR` to a directory — every generation is saved there automatically, or
- Pass `save_to_file: true` (and optionally `output_path`) on a specific call.

Saved images are also indexed in the `generated-image://` resources above.

## Connecting to MCP clients

All examples below use `npx -y @amit-y11/nanobanana-mcp` (the published package) and the Gemini API key mode for brevity. To use a different auth mode, swap the `env` block for the one shown in [Authentication](#authentication) — everything else about each config stays the same. Running from a local clone instead? See the note at the end of [Installation](#installation).

### Claude Desktop

Edit your config file (create it if it doesn't exist):

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%AppData%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nanobanana": {
      "command": "npx",
      "args": ["-y", "@amit-y11/nanobanana-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key"
      }
    }
  }
}
```

Restart Claude Desktop fully (not just the window) afterwards.

### Claude Code

Either run:

```bash
claude mcp add --transport stdio --env GEMINI_API_KEY=your-gemini-api-key \
  nanobanana -- npx -y @amit-y11/nanobanana-mcp
```

or add it directly to `.mcp.json` (project scope) or `~/.claude.json` (user scope, under `mcpServers`) using the same shape as the Claude Desktop config above. Verify with `claude mcp list` / the `/mcp` command.

### VS Code (GitHub Copilot)

Create `.vscode/mcp.json` in your workspace (or use **MCP: Open User Configuration** for a global config). VS Code requires an explicit `"type"` field and uses `servers`, not `mcpServers`:

```json
{
  "servers": {
    "nanobanana": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@amit-y11/nanobanana-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key"
      }
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "nanobanana": {
      "command": "npx",
      "args": ["-y", "@amit-y11/nanobanana-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key"
      }
    }
  }
}
```

Restart Cursor afterwards.

### OpenAI Codex (CLI and IDE extension)

Codex uses TOML, shared between the CLI and the IDE extension, at `~/.codex/config.toml` (or a project-scoped `.codex/config.toml` for trusted projects):

```toml
[mcp_servers.nanobanana]
command = "npx"
args = ["-y", "@amit-y11/nanobanana-mcp"]

[mcp_servers.nanobanana.env]
GEMINI_API_KEY = "your-gemini-api-key"
```

Or via the CLI:

```bash
codex mcp add nanobanana --env GEMINI_API_KEY=your-gemini-api-key \
  -- npx -y @amit-y11/nanobanana-mcp
```

Run `/mcp` inside a Codex session afterwards to confirm it's connected.

> **Windows note:** `npx` on Windows sometimes needs the `.cmd` shim — if a client can't spawn it, try `"command": "npx.cmd"` (or the full path from `where npx`).

## Development

```bash
npm run dev       # tsc --watch
npm run build     # one-off build
npm run inspect   # build, then open the MCP Inspector against the built server
```

[MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) is the fastest way to poke at tools/resources/prompts by hand without wiring up a full client.

### Logging

Everything is logged to **stderr only** — on the stdio transport, stdout is the JSON-RPC wire, and anything else written there corrupts every message after it. Set `NANOBANANA_LOG_LEVEL=debug` for more detail (cache hits, etc.).

## Troubleshooting

- **"No credentials found" on startup** — you haven't set any of the three auth modes' variables. Check `.env.example` and the table above.
- **"NANOBANANA_AUTH_MODE=... requires ..."** — you forced a mode with `NANOBANANA_AUTH_MODE` but didn't set that mode's required variables.
- **Server doesn't show up in your client** — confirm the path in `args` is absolute, that you ran `npm run build` (the client runs `build/index.js`, not `src/index.ts`), and restart the client fully.
- **Call `auth_status`** to confirm which credential mode is active and see basic cache stats without leaving your MCP client.

## License

MIT — see [LICENSE](./LICENSE).
