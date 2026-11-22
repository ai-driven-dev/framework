import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BundledSchemaProviderAdapter } from "../../../../src/contexts/translate/infrastructure/schema-provider.js";
import { AssetNotFoundError } from "../../../../src/shared/domain/shared.error.js";
import { REPOSITORY_ROOT } from "../../../shared/testing/repository-root.builder.js";

const SCHEMAS = join(REPOSITORY_ROOT, "cli", "assets", "schemas");

describe("BundledSchemaProviderAdapter.loadSchema", () => {
  it.each([
    ["plugin-manifest", "claude-code-plugin-manifest.json"],
    ["marketplace", "copilot-plugin-marketplace.json"],
    ["claude-marketplace", "claude-marketplace-manifest.json"],
    ["codex-marketplace", "codex-marketplace-manifest.json"],
    ["codex-plugin-manifest", "codex-plugin-manifest.json"],
  ] as const)("reads %s from the bundled schema file %s", (name, file) => {
    expect(new BundledSchemaProviderAdapter().loadSchema(name)).toStrictEqual(
      JSON.parse(readFileSync(join(SCHEMAS, file), "utf8"))
    );
  });

  it("names the file it could not find when a schema is not shipped", () => {
    // @ts-expect-error a name outside SchemaName is what the loader must refuse
    expect(() => new BundledSchemaProviderAdapter().loadSchema("nope")).toThrow(AssetNotFoundError);
  });

  it("returns a Copilot-native marketplace schema with required fields including metadata", () => {
    const schema = new BundledSchemaProviderAdapter().loadSchema("marketplace");
    expect(schema).toHaveProperty(
      "required",
      expect.arrayContaining(["name", "metadata", "owner", "plugins"])
    );
    expect(schema).toHaveProperty("properties.metadata.properties.pluginRoot");
    expect(schema).toHaveProperty("$comment", expect.stringMatching(/awesome-copilot/i));
  });

  it("returns the same object on a second call", () => {
    const provider = new BundledSchemaProviderAdapter();
    expect(provider.loadSchema("marketplace")).toBe(provider.loadSchema("marketplace"));
  });
});
