/**
 * A minimal leveled logger that writes exclusively to stderr.
 *
 * This is not a stylistic choice: on the stdio transport, stdout is the
 * JSON-RPC wire. Anything else written there — a stray console.log, a
 * library that logs by default — corrupts every message after it and takes
 * the whole server down. Every log call in this project goes through here.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function currentLevel(): LogLevel {
  const raw = process.env.NANOBANANA_LOG_LEVEL?.trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel()];
}

function write(level: LogLevel, message: string, extra?: unknown): void {
  if (!shouldLog(level)) return;
  const timestamp = new Date().toISOString();
  const line = `[nanobanana-mcp] ${timestamp} ${level.toUpperCase()} ${message}`;
  if (extra !== undefined) {
    console.error(line, extra);
  } else {
    console.error(line);
  }
}

export const logger = {
  debug: (message: string, extra?: unknown) => write("debug", message, extra),
  info: (message: string, extra?: unknown) => write("info", message, extra),
  warn: (message: string, extra?: unknown) => write("warn", message, extra),
  error: (message: string, extra?: unknown) => write("error", message, extra),
};
