import "../../../src/domain/tools/ai/claude.js";
import "../../../src/domain/tools/ai/codex.js";
import "../../../src/domain/tools/ai/copilot.js";
import "../../../src/domain/tools/ai/cursor.js";
import "../../../src/domain/tools/ai/opencode.js";
import "../../../src/domain/tools/ide/vscode.js";
import { describe, expect, it } from "vitest";
import { detectMigrationPlan } from "../../../src/application/use-cases/migrate-use-case.js";
import { Manifest } from "../../../src/domain/models/manifest.js";

function makeManifest(data: unknown): Manifest {
  return Manifest.fromJSON(data);
}

const BASE = {
  version: 5,
  docsDir: "aidd_docs",
  tools: {},
  scripts: null,
  plugins: null,
  mode: "local",
};

describe("detectMigrationPlan", () => {
  describe("empty plan", () => {
    it("returns empty plan for clean manifest", () => {
      const manifest = makeManifest(BASE);
      const plan = detectMigrationPlan(manifest);
      expect(plan.hasObsoleteScripts).toBe(false);
      expect(plan.hasObsoletePlugins).toBe(false);
      expect(plan.bundledPlugins.size).toBe(0);
    });

    it("ignores marketplace-linked plugins", () => {
      const manifest = makeManifest({
        ...BASE,
        tools: {
          claude: {
            toolId: "claude",
            version: "1.0.0",
            files: [],
            plugins: [
              {
                name: "aidd-context",
                source: { kind: "local", path: "plugins/aidd-context" },
                version: "1.0.0",
                strict: false,
                files: {},
                marketplace: "aidd-framework",
              },
            ],
          },
        },
      });
      const plan = detectMigrationPlan(manifest);
      expect(plan.bundledPlugins.size).toBe(0);
    });
  });

  describe("scripts section", () => {
    it("detects obsolete scripts section", () => {
      const manifest = makeManifest({
        ...BASE,
        scripts: {
          version: "1.0.0",
          files: [{ relativePath: "scripts/build.sh", hash: "a".repeat(32) }],
        },
      });
      const plan = detectMigrationPlan(manifest);
      expect(plan.hasObsoleteScripts).toBe(true);
      expect(plan.obsoleteScriptFiles).toEqual(["scripts/build.sh"]);
    });
  });

  describe("top-level plugins section", () => {
    it("detects obsolete plugins section", () => {
      const manifest = makeManifest({
        ...BASE,
        plugins: { version: "1.0.0", files: [] },
      });
      const plan = detectMigrationPlan(manifest);
      expect(plan.hasObsoletePlugins).toBe(true);
    });
  });

  describe("bundled plugins", () => {
    it("detects bundled plugin in single tool", () => {
      const manifest = makeManifest({
        ...BASE,
        tools: {
          claude: {
            toolId: "claude",
            version: "1.0.0",
            files: [],
            plugins: [
              {
                name: "aidd-context",
                source: { kind: "local", path: "plugins/aidd-context" },
                version: "1.0.0",
                strict: false,
                files: {},
              },
            ],
          },
        },
      });
      const plan = detectMigrationPlan(manifest);
      expect(plan.bundledPlugins.size).toBe(1);
      expect(plan.bundledPlugins.get("aidd-context")).toEqual(["claude"]);
    });

    it("groups same plugin name across multiple tools", () => {
      const bundledPlugin = {
        name: "aidd-context",
        source: { kind: "local", path: "plugins/aidd-context" },
        version: "1.0.0",
        strict: false,
        files: {},
      };
      const manifest = makeManifest({
        ...BASE,
        tools: {
          claude: { toolId: "claude", version: "1.0.0", files: [], plugins: [bundledPlugin] },
          cursor: { toolId: "cursor", version: "1.0.0", files: [], plugins: [bundledPlugin] },
        },
      });
      const plan = detectMigrationPlan(manifest);
      expect(plan.bundledPlugins.get("aidd-context")?.sort()).toEqual(["claude", "cursor"].sort());
    });

    it("skips IDE tools (vscode)", () => {
      const manifest = makeManifest({
        ...BASE,
        tools: {
          vscode: { toolId: "vscode", version: "1.0.0", files: [], plugins: [] },
        },
      });
      const plan = detectMigrationPlan(manifest);
      expect(plan.bundledPlugins.size).toBe(0);
    });
  });
});
