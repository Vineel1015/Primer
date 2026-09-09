/**
 * Cheap pre-flight so a missing key produces one clear line instead of a stack
 * trace. Mirrors the SDK's own resolution order: API key, auth token, or an
 * `ant auth login` profile on disk.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function hasAnthropicCredentials(): boolean {
  if (process.env["ANTHROPIC_API_KEY"] || process.env["ANTHROPIC_AUTH_TOKEN"]) return true;
  return existsSync(join(homedir(), ".config", "anthropic"));
}

export const NO_CREDENTIALS_MESSAGE = [
  "No Anthropic credentials found.",
  "Set ANTHROPIC_API_KEY for this shell (PowerShell: $env:ANTHROPIC_API_KEY = \"sk-ant-...\")",
  "or persist it (setx ANTHROPIC_API_KEY \"sk-ant-...\", then open a new terminal),",
  "or run `ant auth login`. To exercise the pipeline offline, pass --generator mock.",
].join("\n");
