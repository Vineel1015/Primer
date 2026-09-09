/**
 * List-price cost estimate per model, USD per million tokens.
 * Cache reads are billed at 10% of input; cache writes at 125%.
 */
import type { Usage } from "./author.js";

export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateCostUsd(usage: Usage, model: string, batch = false): number {
  const p = PRICES[model];
  if (!p) return Number.NaN;
  const perM = (n: number, rate: number) => (n / 1_000_000) * rate;
  const total =
    perM(usage.inputTokens, p.input) +
    perM(usage.cacheReadTokens, p.input * 0.1) +
    perM(usage.cacheWriteTokens, p.input * 1.25) +
    perM(usage.outputTokens, p.output);
  return batch ? total / 2 : total;
}
