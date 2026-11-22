import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { JsonSchemaValidationError } from "../../../../src/contexts/translate/domain/translate.error.js";
import { InvalidSourceMarketplaceError } from "../../../../src/shared/domain/shared.error.js";
import { buildContractOf } from "../../../shared/testing/build-contract-of.builder.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import type { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../shared/testing/saying.builder.js";
import {
  makeAssetProvider,
  makeSeededFs,
  makeUseCase,
  OUT_DIR,
  SOURCE_DIR,
} from "../testing/build-native-tree-world.builder.js";
import { buildTree } from "../testing/build-tree.builder.js";
import { minimalSchemas } from "../testing/schema-provider.builder.js";

describe("BuildNativeTree marketplace", () => {
  let fs: InMemoryFileAdapter;
  let logger: CapturingLogger;

  beforeEach(async () => {
    fs = await makeSeededFs();
    logger = new CapturingLogger();
  });

  describe("source marketplace parse", () => {
    it("throws InvalidSourceMarketplaceError when marketplace.json has malformed JSON", async () => {
      fs.setFile(`${SOURCE_DIR}/.claude-plugin/marketplace.json`, "not-json{");
      const uc = makeUseCase(fs);
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
      ).rejects.toThrow(saying(/^Invalid source marketplace: malformed JSON: /));
    });

    it("throws InvalidSourceMarketplaceError when 'plugins' array is missing", async () => {
      fs.setFile(
        `${SOURCE_DIR}/.claude-plugin/marketplace.json`,
        JSON.stringify({ name: "test", owner: { name: "X" } })
      );
      const uc = makeUseCase(fs);
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
      ).rejects.toThrow(saying("Invalid source marketplace: missing 'plugins' array."));
    });

    it("throws InvalidSourceMarketplaceError when a plugin entry is null", async () => {
      fs.setFile(
        `${SOURCE_DIR}/.claude-plugin/marketplace.json`,
        JSON.stringify({ name: "test", owner: { name: "X" }, plugins: [null] })
      );
      const uc = makeUseCase(fs);
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
      ).rejects.toThrow(
        saying("Invalid source marketplace: each plugin entry must have a 'name' string.")
      );
    });

    it("throws InvalidSourceMarketplaceError when a plugin name does not match a directory", async () => {
      fs.setFile(
        `${SOURCE_DIR}/.claude-plugin/marketplace.json`,
        JSON.stringify({
          name: "test",
          owner: { name: "X" },
          plugins: [{ name: "nonexistent-plugin", source: "./plugins/nonexistent-plugin" }],
        })
      );
      const uc = makeUseCase(fs);
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
      ).rejects.toThrow(
        saying(
          `Invalid source marketplace: plugin 'nonexistent-plugin' not found at ${join(
            SOURCE_DIR,
            "plugins",
            "nonexistent-plugin"
          )}.`
        )
      );
    });

    it("names the catalog it could not read at all", async () => {
      await fs.deleteFile(`${SOURCE_DIR}/.claude-plugin/marketplace.json`);
      const uc = makeUseCase(fs);
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
      ).rejects.toThrow(
        saying(
          `Invalid source marketplace: cannot read ${join(
            SOURCE_DIR,
            ".claude-plugin/marketplace.json"
          )}.`
        )
      );
    });

    for (const root of ["null", '"a catalog"', "[]"]) {
      it(`refuses a catalog whose root reads ${root}`, async () => {
        fs.setFile(`${SOURCE_DIR}/.claude-plugin/marketplace.json`, root);
        const uc = makeUseCase(fs);
        await expect(
          uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
        ).rejects.toThrow(saying("Invalid source marketplace: root must be an object."));
      });
    }

    for (const entry of ["null", "5", "{}"]) {
      it(`refuses a plugin entry that reads ${entry}`, async () => {
        fs.setFile(
          `${SOURCE_DIR}/.claude-plugin/marketplace.json`,
          `{ "name": "test", "owner": { "name": "X" }, "plugins": [${entry}] }`
        );
        const uc = makeUseCase(fs);
        await expect(
          uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
        ).rejects.toThrow(
          saying("Invalid source marketplace: each plugin entry must have a 'name' string.")
        );
      });
    }
  });

  describe("marketplace field sourcing", () => {
    it("uses version from source marketplace entry when present", async () => {
      fs.setFile(
        `${SOURCE_DIR}/.claude-plugin/marketplace.json`,
        JSON.stringify({
          name: "aidd-framework",
          version: "0.1.0",
          description: "Test marketplace",
          owner: { name: "Test" },
          plugins: [
            {
              name: "aidd-test",
              source: "./plugins/aidd-test",
              description: "Test plugin",
              version: "9.9.9",
            },
          ],
        })
      );
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const marketplaceOut = JSON.parse(
        fs.getFile(`${OUT_DIR}/.plugin/marketplace.json`) ?? "{}"
      ) as { plugins: { version: string }[] };
      expect(marketplaceOut.plugins[0].version).toBe("9.9.9");
    });

    it("falls back to plugin.json version when source marketplace entry has no version", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const marketplaceOut = JSON.parse(
        fs.getFile(`${OUT_DIR}/.plugin/marketplace.json`) ?? "{}"
      ) as { plugins: { version: string }[] };
      expect(marketplaceOut.plugins[0].version).toBe("0.1.0");
    });

    it("throws InvalidSourceMarketplaceError when version cannot be resolved", async () => {
      fs.setFile(
        `${SOURCE_DIR}/plugins/aidd-test/.claude-plugin/plugin.json`,
        JSON.stringify({ name: "aidd-test", description: "Test" })
      );
      const uc = makeUseCase(fs);
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
      ).rejects.toThrow(InvalidSourceMarketplaceError);
    });

    it("throws InvalidSourceMarketplaceError when description cannot be resolved from either source", async () => {
      fs.setFile(
        `${SOURCE_DIR}/.claude-plugin/marketplace.json`,
        JSON.stringify({
          name: "aidd-framework",
          version: "0.1.0",
          owner: { name: "Test" },
          plugins: [{ name: "aidd-test", source: "./plugins/aidd-test", version: "0.1.0" }],
        })
      );
      fs.setFile(
        `${SOURCE_DIR}/plugins/aidd-test/.claude-plugin/plugin.json`,
        JSON.stringify({ name: "aidd-test", version: "0.1.0" })
      );
      const uc = makeUseCase(fs);
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
      ).rejects.toThrow(InvalidSourceMarketplaceError);
    });
  });

  describe("marketplace emission", () => {
    it("emits marketplace.json at the OpenPlugin output path", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      expect(fs.has(`${OUT_DIR}/.plugin/marketplace.json`)).toBe(true);
    });

    it("emitted marketplace.json has Copilot-native shape with metadata.pluginRoot", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const raw = fs.getFile(`${OUT_DIR}/.plugin/marketplace.json`) ?? "";
      const parsed = JSON.parse(raw) as {
        metadata: { pluginRoot: string };
        plugins: { source: string }[];
      };
      expect(parsed.metadata.pluginRoot).toBe("./plugins");
      expect(parsed.plugins[0].source).toBe("aidd-test");
      expect(raw.endsWith("\n")).toBe(true);
    });

    it("emitted marketplace.json carries none of the source catalog's $schema, strict or recommended", async () => {
      const uc = makeUseCase(fs);
      await uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot });
      const raw = fs.getFile(`${OUT_DIR}/.plugin/marketplace.json`) ?? "";
      expect(raw).not.toContain("$schema");
      expect(raw).not.toContain("strict");
      expect(raw).not.toContain("recommended");
    });

    it("validates the emitted marketplace.json against the schema", async () => {
      const failingMarketplaceValidator = {
        validate(schema: object, _data: unknown): void {
          const properties = Object.entries(schema).find(([key]) => key === "properties")?.[1];
          if (typeof properties === "object" && properties !== null && "plugins" in properties) {
            throw new JsonSchemaValidationError(["marketplace schema fail"]);
          }
        },
      };
      const ap = makeAssetProvider();
      const uc = buildTree(
        fs,
        failingMarketplaceValidator,
        ap,
        logger,
        buildContractOf(registeredTools(), TOOL.copilot, "marketplace"),
        "marketplace",
        false,
        minimalSchemas
      );
      await expect(
        uc.execute({ sourceDir: SOURCE_DIR, outDir: OUT_DIR, target: TOOL.copilot })
      ).rejects.toThrow(JsonSchemaValidationError);
    });
  });
});
