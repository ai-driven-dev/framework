import "../../../src/domain/tools/ai/claude.js";
import "../../../src/domain/tools/ai/codex.js";
import "../../../src/domain/tools/ai/copilot.js";
import "../../../src/domain/tools/ai/cursor.js";
import "../../../src/domain/tools/ai/opencode.js";
import "../../../src/domain/tools/ide/vscode.js";
import { describe, expect, it } from "vitest";
import { computeMigrationPlan } from "../../../src/application/use-cases/migrate-use-case.js";

const BASE = {
  version: 5,
  tools: {},
  marketplaces: {},
};

describe("computeMigrationPlan", () => {
  describe("no-op plan", () => {
    it("returns no-op for clean v5 manifest with default marketplace", () => {
      const plan = computeMigrationPlan({
        ...BASE,
        marketplaces: { "aidd-framework": {} },
      });
      expect(plan.isNoOp()).toBe(true);
    });

    it("ignores marketplace-linked plugins", () => {
      const plan = computeMigrationPlan({
        ...BASE,
        marketplaces: { "aidd-framework": {} },
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
      expect(plan.pluginsToRewire.length).toBe(0);
      expect(plan.isNoOp()).toBe(true);
    });
  });

  describe("legacy fields detection", () => {
    it("detects legacy scripts section", () => {
      const plan = computeMigrationPlan({
        ...BASE,
        scripts: {
          version: "1.0.0",
          files: [{ relativePath: "scripts/build.sh", hash: "a".repeat(32) }],
        },
      });
      expect(plan.fieldsToStrip).toContain("scripts");
      expect(plan.filesToDelete).toContain("scripts/build.sh");
    });

    it("detects legacy top-level plugins section", () => {
      const plan = computeMigrationPlan({
        ...BASE,
        plugins: { version: "1.0.0", files: [] },
      });
      expect(plan.fieldsToStrip).toContain("plugins");
    });

    it("detects legacy mode field", () => {
      const plan = computeMigrationPlan({ ...BASE, mode: "local" });
      expect(plan.fieldsToStrip).toContain("mode");
    });
  });

  describe("marketplace detection", () => {
    it("flags missing default marketplace", () => {
      const plan = computeMigrationPlan(BASE);
      expect(plan.defaultMarketplaceMissing).toBe(true);
    });

    it("does not flag when default marketplace present", () => {
      const plan = computeMigrationPlan({
        ...BASE,
        marketplaces: { "aidd-framework": {} },
      });
      expect(plan.defaultMarketplaceMissing).toBe(false);
    });
  });

  describe("bundled plugins", () => {
    it("detects bundled plugin in single tool", () => {
      const plan = computeMigrationPlan({
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
      expect(plan.pluginsToRewire.length).toBe(1);
      const rewired = plan.pluginsToRewire[0];
      expect(rewired?.name).toBe("aidd-context");
      expect(rewired?.marketplace).toBe("aidd-framework");
      expect(rewired?.toolIds).toContain("claude");
    });

    it("groups same plugin name across multiple tools", () => {
      const bundledPlugin = {
        name: "aidd-context",
        source: { kind: "local", path: "plugins/aidd-context" },
        version: "1.0.0",
        strict: false,
        files: {},
      };
      const plan = computeMigrationPlan({
        ...BASE,
        tools: {
          claude: { toolId: "claude", version: "1.0.0", files: [], plugins: [bundledPlugin] },
          cursor: { toolId: "cursor", version: "1.0.0", files: [], plugins: [bundledPlugin] },
        },
      });
      const rewired = plan.pluginsToRewire[0];
      expect(rewired?.name).toBe("aidd-context");
      expect([...(rewired?.toolIds ?? [])].sort()).toEqual(["claude", "cursor"].sort());
    });

    it("skips IDE tools (vscode)", () => {
      const plan = computeMigrationPlan({
        ...BASE,
        tools: {
          vscode: { toolId: "vscode", version: "1.0.0", files: [], plugins: [] },
        },
      });
      expect(plan.pluginsToRewire.length).toBe(0);
    });
  });
});
