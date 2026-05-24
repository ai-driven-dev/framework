/**
 * Integration test: real BundledAssetProviderAdapter + real AjvSchemaValidatorAdapter
 * validates that every kind of scaffold produces a plugin.json that passes the
 * bundled claude-code-plugin-manifest.json schema.
 */

import { describe, expect, it } from "vitest";
import type { PluginComponentKind } from "../../../src/domain/models/plugin-component-kind.js";
import { buildScaffold } from "../../../src/domain/models/plugin-scaffold.js";
import { AjvSchemaValidatorAdapter } from "../../../src/infrastructure/adapters/ajv-schema-validator-adapter.js";
import { BundledAssetProviderAdapter } from "../../../src/infrastructure/assets/asset-loader.js";

const ALL_KINDS: PluginComponentKind[] = ["full", "skills", "agents", "hooks", "mcp"];

describe("plugin manifest schema validation (real adapters)", () => {
  const assetProvider = new BundledAssetProviderAdapter();
  const validator = new AjvSchemaValidatorAdapter();
  const schema = assetProvider.loadPluginManifestSchema();

  for (const kind of ALL_KINDS) {
    it(`scaffold kind '${kind}' generates a valid plugin.json`, () => {
      const scaffold = buildScaffold({
        name: "test-plugin",
        version: "0.1.0",
        description: "Test",
        kind,
      });
      const manifestContent = scaffold.get(".claude-plugin/plugin.json");
      expect(manifestContent).toBeDefined();
      const manifest = JSON.parse(manifestContent as string);
      expect(() => validator.validate(schema, manifest)).not.toThrow();
    });
  }
});
