import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginCreateUseCase } from "../../../../src/application/use-cases/plugin/plugin-create-use-case.js";
import {
  InvalidPluginNameError,
  JsonSchemaValidationError,
  MarketplaceEntryAlreadyExistsError,
  PluginTargetExistsError,
} from "../../../../src/domain/errors.js";
import type { AssetProvider } from "../../../../src/domain/ports/asset-provider.js";
import type { JsonSchemaValidator } from "../../../../src/domain/ports/json-schema-validator.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { ScriptedPrompter } from "../../../helpers/ports/scripted-prompter.js";

const PROJECT_ROOT = "/project";
const OUTPUT_DIR = "/project/output";

function makeMinimalManifestSchema(): object {
  return { type: "object", properties: { name: { type: "string" } }, required: ["name"] };
}

function makeAssetProvider(schema = makeMinimalManifestSchema()): AssetProvider {
  return {
    loadConfigAsset: () => {
      throw new Error("not used");
    },
    loadDefaultMarketplace: () => {
      throw new Error("not used");
    },
    loadSchema: (name) => {
      if (name === "plugin-manifest") return schema;
      throw new Error("not used");
    },
  };
}

function makeValidator(): JsonSchemaValidator {
  return {
    validate(_schema: object, data: unknown): void {
      const obj = data as Record<string, unknown>;
      if (typeof obj.name !== "string")
        throw new JsonSchemaValidationError(["name must be string"]);
    },
  };
}

function makeUseCase(
  fs = new InMemoryFileAdapter(),
  prompter = new ScriptedPrompter([]),
  validator = makeValidator(),
  assetProvider = makeAssetProvider(),
  logger = new CapturingLogger()
): PluginCreateUseCase {
  return new PluginCreateUseCase(fs, prompter, validator, assetProvider, logger);
}

describe("PluginCreateUseCase", () => {
  describe("name validation", () => {
    it("throws InvalidPluginNameError for invalid name", async () => {
      const uc = makeUseCase();
      await expect(
        uc.execute({
          name: "My Plugin!",
          kind: "full",
          outputDir: OUTPUT_DIR,
          force: false,
          yes: false,
          interactive: false,
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(InvalidPluginNameError);
    });

    it("throws InvalidPluginNameError for uppercase name", async () => {
      const uc = makeUseCase();
      await expect(
        uc.execute({
          name: "MyPlugin",
          kind: "full",
          outputDir: OUTPUT_DIR,
          force: false,
          yes: false,
          interactive: false,
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(InvalidPluginNameError);
    });
  });

  describe("scaffold creation", () => {
    it("writes scaffold files for kind full", async () => {
      const fs = new InMemoryFileAdapter();
      const uc = makeUseCase(fs);
      const result = await uc.execute({
        name: "my-plugin",
        kind: "full",
        outputDir: OUTPUT_DIR,
        force: false,
        yes: false,
        interactive: false,
        projectRoot: PROJECT_ROOT,
      });
      expect(result.filesWritten).toBeGreaterThan(0);
      expect(result.pluginDir).toBe(join(OUTPUT_DIR, "my-plugin"));
      expect(result.marketplaceUpdated).toBe(false);
    });

    it("writes plugin.json manifest", async () => {
      const fs = new InMemoryFileAdapter();
      const uc = makeUseCase(fs);
      await uc.execute({
        name: "my-plugin",
        kind: "skills",
        outputDir: OUTPUT_DIR,
        force: false,
        yes: false,
        interactive: false,
        projectRoot: PROJECT_ROOT,
      });
      const manifestPath = join(OUTPUT_DIR, "my-plugin", ".claude-plugin/plugin.json");
      const manifest = await fs.readFile(manifestPath);
      expect(JSON.parse(manifest)).toMatchObject({ name: "my-plugin" });
    });

    it("writes skills files for kind skills", async () => {
      const fs = new InMemoryFileAdapter();
      const uc = makeUseCase(fs);
      await uc.execute({
        name: "my-plugin",
        kind: "skills",
        outputDir: OUTPUT_DIR,
        force: false,
        yes: false,
        interactive: false,
        projectRoot: PROJECT_ROOT,
      });
      const skillPath = join(OUTPUT_DIR, "my-plugin", "skills/00-example/SKILL.md");
      expect(await fs.fileExists(skillPath)).toBe(true);
    });
  });

  describe("force flag", () => {
    it("throws PluginTargetExistsError when target exists and force is false", async () => {
      const fs = new InMemoryFileAdapter();
      const pluginDir = join(OUTPUT_DIR, "my-plugin");
      await fs.writeFile(`${pluginDir}/existing.txt`, "content");
      const uc = makeUseCase(fs);
      await expect(
        uc.execute({
          name: "my-plugin",
          kind: "full",
          outputDir: OUTPUT_DIR,
          force: false,
          yes: false,
          interactive: false,
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(PluginTargetExistsError);
    });

    it("overwrites when force is true", async () => {
      const fs = new InMemoryFileAdapter();
      const pluginDir = join(OUTPUT_DIR, "my-plugin");
      await fs.writeFile(`${pluginDir}/existing.txt`, "old content");
      const uc = makeUseCase(fs);
      const result = await uc.execute({
        name: "my-plugin",
        kind: "full",
        outputDir: OUTPUT_DIR,
        force: true,
        yes: false,
        interactive: false,
        projectRoot: PROJECT_ROOT,
      });
      expect(result.filesWritten).toBeGreaterThan(0);
      expect(await fs.fileExists(`${pluginDir}/existing.txt`)).toBe(false);
    });
  });

  describe("marketplace integration", () => {
    it("does not update marketplace if file is absent", async () => {
      const fs = new InMemoryFileAdapter();
      const uc = makeUseCase(fs);
      const result = await uc.execute({
        name: "my-plugin",
        kind: "full",
        outputDir: OUTPUT_DIR,
        force: false,
        yes: false,
        interactive: false,
        projectRoot: PROJECT_ROOT,
      });
      expect(result.marketplaceUpdated).toBe(false);
    });

    it("does not update marketplace in non-interactive yes mode", async () => {
      const fs = new InMemoryFileAdapter();
      const marketplacePath = join(PROJECT_ROOT, ".claude-plugin/marketplace.json");
      await fs.writeFile(marketplacePath, JSON.stringify({ plugins: [] }));
      const uc = makeUseCase(fs);
      const result = await uc.execute({
        name: "my-plugin",
        kind: "full",
        outputDir: OUTPUT_DIR,
        force: false,
        yes: true,
        interactive: true,
        projectRoot: PROJECT_ROOT,
      });
      expect(result.marketplaceUpdated).toBe(false);
    });

    it("appends to marketplace when interactive and confirmed", async () => {
      const fs = new InMemoryFileAdapter();
      const marketplacePath = join(PROJECT_ROOT, ".claude-plugin/marketplace.json");
      await fs.writeFile(marketplacePath, JSON.stringify({ plugins: [] }));
      const prompter = new ScriptedPrompter([{ type: "confirm", value: true }]);
      const uc = makeUseCase(fs, prompter);
      const result = await uc.execute({
        name: "my-plugin",
        kind: "full",
        outputDir: OUTPUT_DIR,
        force: false,
        yes: false,
        interactive: true,
        projectRoot: PROJECT_ROOT,
      });
      expect(result.marketplaceUpdated).toBe(true);
      const updated = JSON.parse(await fs.readFile(marketplacePath)) as { plugins: unknown[] };
      expect(updated.plugins).toHaveLength(1);
    });

    it("throws MarketplaceEntryAlreadyExistsError on duplicate name", async () => {
      const fs = new InMemoryFileAdapter();
      const marketplacePath = join(PROJECT_ROOT, ".claude-plugin/marketplace.json");
      await fs.writeFile(
        marketplacePath,
        JSON.stringify({
          plugins: [
            {
              name: "my-plugin",
              version: "0.1.0",
              source: ".",
              description: "",
              recommended: false,
              strict: false,
            },
          ],
        })
      );
      const prompter = new ScriptedPrompter([{ type: "confirm", value: true }]);
      const uc = makeUseCase(fs, prompter);
      await expect(
        uc.execute({
          name: "my-plugin",
          kind: "full",
          outputDir: OUTPUT_DIR,
          force: false,
          yes: false,
          interactive: true,
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(MarketplaceEntryAlreadyExistsError);
    });
  });

  describe("schema validation", () => {
    it("throws JsonSchemaValidationError when validator rejects manifest", async () => {
      const rejectingValidator: JsonSchemaValidator = {
        validate() {
          throw new JsonSchemaValidationError(["name is required"]);
        },
      };
      const uc = makeUseCase(
        new InMemoryFileAdapter(),
        new ScriptedPrompter([]),
        rejectingValidator
      );
      await expect(
        uc.execute({
          name: "my-plugin",
          kind: "full",
          outputDir: OUTPUT_DIR,
          force: false,
          yes: false,
          interactive: false,
          projectRoot: PROJECT_ROOT,
        })
      ).rejects.toThrow(JsonSchemaValidationError);
    });
  });
});
