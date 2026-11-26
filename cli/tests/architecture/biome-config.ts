import type { BiomeConfig, BiomeOverride } from "../../scripts/generate-biome-boundaries.mjs";
import { isRecord } from "../shared/testing/json-value.builder.js";
import { read } from "./source-graph.js";

export interface Override extends BiomeOverride {
  plugins?: string[];
  linter?: NonNullable<BiomeOverride["linter"]> & {
    rules?: Record<string, Record<string, unknown> | undefined> & {
      style?: { noRestrictedGlobals?: { options?: unknown } };
    };
  };
}
interface BiomeFile extends BiomeConfig {
  overrides?: Override[];
}

const isBiomeFile = (value: unknown): value is BiomeFile =>
  isRecord(value) && (value.overrides === undefined || Array.isArray(value.overrides));

export function biomeConfig(): BiomeFile {
  const value: unknown = JSON.parse(read("biome.json"));
  if (!isBiomeFile(value)) throw new Error("biome.json: expected `overrides` to be a list");
  return value;
}
