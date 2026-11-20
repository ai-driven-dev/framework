import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { wireTools } from "../../../src/composition/tools.js";
import { AssetNotFoundError } from "../../../src/shared/domain/errors.js";
import { BundledAssetProviderAdapter } from "../../../src/shared/infrastructure/asset-loader.js";
import { REPOSITORY_ROOT } from "../testing/repository-root.builder.js";

const SCHEMAS = join(REPOSITORY_ROOT, "cli", "assets", "schemas");

describe("BundledAssetProviderAdapter.loadSchema", () => {
  it.each([
    ["plugin-manifest", "claude-code-plugin-manifest.json"],
    ["marketplace", "copilot-plugin-marketplace.json"],
    ["claude-marketplace", "claude-marketplace-manifest.json"],
    ["codex-marketplace", "codex-marketplace-manifest.json"],
    ["codex-plugin-manifest", "codex-plugin-manifest.json"],
  ] as const)("reads %s from the bundled schema file %s", (name, file) => {
    expect(new BundledAssetProviderAdapter(wireTools()).loadSchema(name)).toStrictEqual(
      JSON.parse(readFileSync(join(SCHEMAS, file), "utf8"))
    );
  });

  it("names the file it could not find when a schema is not shipped", () => {
    const provider = new BundledAssetProviderAdapter(wireTools());
    // @ts-expect-error a name outside SchemaName is what the loader must refuse
    expect(() => provider.loadSchema("nope")).toThrow(AssetNotFoundError);
  });
});
