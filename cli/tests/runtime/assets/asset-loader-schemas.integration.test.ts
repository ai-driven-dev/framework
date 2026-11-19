import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BundledAssetProviderAdapter } from "../../../src/runtime/assets/asset-loader.js";
import { REPOSITORY_ROOT } from "../../helpers/repository-root.js";

const SCHEMAS = join(REPOSITORY_ROOT, "cli", "assets", "schemas");

describe("BundledAssetProviderAdapter.loadSchema", () => {
  it.each([
    ["plugin-manifest", "claude-code-plugin-manifest.json"],
    ["marketplace", "copilot-plugin-marketplace.json"],
    ["claude-marketplace", "claude-marketplace-manifest.json"],
    ["codex-marketplace", "codex-marketplace-manifest.json"],
    ["codex-plugin-manifest", "codex-plugin-manifest.json"],
  ] as const)("reads %s from the bundled schema file %s", (name, file) => {
    expect(new BundledAssetProviderAdapter().loadSchema(name)).toStrictEqual(
      JSON.parse(readFileSync(join(SCHEMAS, file), "utf8"))
    );
  });
});
