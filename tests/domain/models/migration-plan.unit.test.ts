import { describe, expect, it } from "vitest";
import type { MigrationPlanParams } from "../../../src/domain/models/migration-plan.js";
import { MigrationPlan } from "../../../src/domain/models/migration-plan.js";
import type { AiToolId } from "../../../src/domain/models/tool-ids.js";

function rewire(name: string, toolIds: AiToolId[]) {
  return { name, marketplace: "aidd-framework", toolIds } as const;
}

const BASE_PARAMS: MigrationPlanParams = {
  fromVersion: 6,
  fieldsToStrip: [],
  filesToDelete: [],
  pluginsToRewire: [],
  defaultMarketplaceMissing: false,
  userMemoryFiles: ["CLAUDE.md", "AGENTS.md"],
};

describe("MigrationPlan", () => {
  describe("constructor validation", () => {
    it("accepts valid fromVersion values", () => {
      for (const v of [1, 2, 3, 4, 5, 6]) {
        expect(() => new MigrationPlan({ ...BASE_PARAMS, fromVersion: v })).not.toThrow();
      }
    });

    it("throws on invalid fromVersion", () => {
      expect(() => new MigrationPlan({ ...BASE_PARAMS, fromVersion: 0 })).toThrow();
      expect(() => new MigrationPlan({ ...BASE_PARAMS, fromVersion: 7 })).toThrow();
    });

    it("toVersion is always 6", () => {
      const plan = new MigrationPlan(BASE_PARAMS);
      expect(plan.toVersion).toBe(6);
    });
  });

  describe("isNoOp()", () => {
    it("returns true for clean v5 manifest with default marketplace", () => {
      const plan = new MigrationPlan(BASE_PARAMS);
      expect(plan.isNoOp()).toBe(true);
    });

    it("returns true for clean v6 manifest with default marketplace", () => {
      const plan = new MigrationPlan({ ...BASE_PARAMS, fromVersion: 6 });
      expect(plan.isNoOp()).toBe(true);
    });

    it("returns false when fromVersion < 5", () => {
      const plan = new MigrationPlan({ ...BASE_PARAMS, fromVersion: 4 });
      expect(plan.isNoOp()).toBe(false);
    });

    it("returns false when defaultMarketplaceMissing", () => {
      const plan = new MigrationPlan({ ...BASE_PARAMS, defaultMarketplaceMissing: true });
      expect(plan.isNoOp()).toBe(false);
    });

    it("returns false when fieldsToStrip is non-empty", () => {
      const plan = new MigrationPlan({ ...BASE_PARAMS, fieldsToStrip: ["mode"] });
      expect(plan.isNoOp()).toBe(false);
    });

    it("returns false when filesToDelete is non-empty", () => {
      const plan = new MigrationPlan({ ...BASE_PARAMS, filesToDelete: ["scripts/build.sh"] });
      expect(plan.isNoOp()).toBe(false);
    });

    it("returns false when pluginsToRewire is non-empty", () => {
      const plan = new MigrationPlan({
        ...BASE_PARAMS,
        pluginsToRewire: [rewire("aidd-context", ["claude"])],
      });
      expect(plan.isNoOp()).toBe(false);
    });
  });

  describe("describe()", () => {
    it("includes version header", () => {
      const plan = new MigrationPlan({ ...BASE_PARAMS, fromVersion: 4 });
      expect(plan.describe()).toContain("v4 → v6");
    });

    it("lists fields to strip", () => {
      const plan = new MigrationPlan({ ...BASE_PARAMS, fieldsToStrip: ["mode", "docs"] });
      expect(plan.describe()).toContain("Strip legacy fields: mode, docs");
    });

    it("lists files to delete with count", () => {
      const plan = new MigrationPlan({ ...BASE_PARAMS, filesToDelete: ["scripts/build.sh"] });
      const description = plan.describe();
      expect(description).toContain("Delete 1 legacy file(s) from disk");
      expect(description).toContain("scripts/build.sh");
    });

    it("lists plugins to rewire", () => {
      const plan = new MigrationPlan({
        ...BASE_PARAMS,
        pluginsToRewire: [rewire("aidd-context", ["claude"])],
      });
      expect(plan.describe()).toContain("aidd-context");
    });

    it("mentions default marketplace registration", () => {
      const plan = new MigrationPlan({ ...BASE_PARAMS, defaultMarketplaceMissing: true });
      expect(plan.describe()).toContain("Register default marketplace");
    });

    it("shows nothing to do when no-op", () => {
      const plan = new MigrationPlan(BASE_PARAMS);
      expect(plan.describe()).toContain("nothing to do");
    });

    it("omits strip-fields line when fieldsToStrip is empty", () => {
      const plan = new MigrationPlan(BASE_PARAMS);
      expect(plan.describe()).not.toContain("Strip legacy fields");
    });

    it("omits files-to-delete line when filesToDelete is empty", () => {
      const plan = new MigrationPlan(BASE_PARAMS);
      expect(plan.describe()).not.toContain("Delete");
    });

    it("omits marketplace-registration line when defaultMarketplaceMissing is false", () => {
      const plan = new MigrationPlan(BASE_PARAMS);
      expect(plan.describe()).not.toContain("Register default marketplace");
    });

    it("omits rewire line when pluginsToRewire is empty", () => {
      const plan = new MigrationPlan(BASE_PARAMS);
      expect(plan.describe()).not.toContain("Rewire");
    });

    it("lists user memory files when present", () => {
      const plan = new MigrationPlan({
        ...BASE_PARAMS,
        userMemoryFiles: ["CLAUDE.md", "memory.md"],
      });
      expect(plan.describe()).toContain("Preserve user memory files: CLAUDE.md, memory.md");
    });

    it("omits user-memory line when userMemoryFiles is empty", () => {
      const plan = new MigrationPlan({ ...BASE_PARAMS, userMemoryFiles: [] });
      expect(plan.describe()).not.toContain("Preserve user memory files");
    });

    it("includes plugin marketplace in rewire description", () => {
      const plan = new MigrationPlan({
        ...BASE_PARAMS,
        pluginsToRewire: [
          { name: "aidd-context", marketplace: "aidd-framework", toolIds: ["claude" as AiToolId] },
        ],
      });
      expect(plan.describe()).toContain("aidd-framework");
    });

    it("includes plugin tool ids in rewire description", () => {
      const plan = new MigrationPlan({
        ...BASE_PARAMS,
        pluginsToRewire: [
          { name: "aidd-context", marketplace: "aidd-framework", toolIds: ["claude" as AiToolId] },
        ],
      });
      expect(plan.describe()).toContain("claude");
    });

    it("does not show nothing-to-do when there are fields to strip", () => {
      const plan = new MigrationPlan({ ...BASE_PARAMS, fieldsToStrip: ["mode"] });
      expect(plan.describe()).not.toContain("nothing to do");
    });
  });

  describe("equals()", () => {
    it("returns true for identical plans", () => {
      const a = new MigrationPlan(BASE_PARAMS);
      const b = new MigrationPlan(BASE_PARAMS);
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when fromVersion differs", () => {
      const a = new MigrationPlan({ ...BASE_PARAMS, fromVersion: 4 });
      const b = new MigrationPlan({ ...BASE_PARAMS, fromVersion: 3 });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when fieldsToStrip differs", () => {
      const a = new MigrationPlan({ ...BASE_PARAMS, fieldsToStrip: ["mode"] });
      const b = new MigrationPlan({ ...BASE_PARAMS, fieldsToStrip: [] });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when pluginsToRewire differs", () => {
      const a = new MigrationPlan({
        ...BASE_PARAMS,
        pluginsToRewire: [{ name: "p1", marketplace: "m1", toolIds: ["claude" as AiToolId] }],
      });
      const b = new MigrationPlan({ ...BASE_PARAMS, pluginsToRewire: [] });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when defaultMarketplaceMissing differs", () => {
      const a = new MigrationPlan({ ...BASE_PARAMS, defaultMarketplaceMissing: true });
      const b = new MigrationPlan({ ...BASE_PARAMS, defaultMarketplaceMissing: false });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when filesToDelete differs", () => {
      const a = new MigrationPlan({ ...BASE_PARAMS, filesToDelete: ["file.sh"] });
      const b = new MigrationPlan({ ...BASE_PARAMS, filesToDelete: [] });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when userMemoryFiles differs", () => {
      const a = new MigrationPlan({ ...BASE_PARAMS, userMemoryFiles: ["CLAUDE.md"] });
      const b = new MigrationPlan({ ...BASE_PARAMS, userMemoryFiles: ["AGENTS.md"] });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when plugin name differs but same length", () => {
      const a = new MigrationPlan({
        ...BASE_PARAMS,
        pluginsToRewire: [
          { name: "plugin-a", marketplace: "market", toolIds: ["claude" as AiToolId] },
        ],
      });
      const b = new MigrationPlan({
        ...BASE_PARAMS,
        pluginsToRewire: [
          { name: "plugin-b", marketplace: "market", toolIds: ["claude" as AiToolId] },
        ],
      });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when plugin marketplace differs but same length", () => {
      const a = new MigrationPlan({
        ...BASE_PARAMS,
        pluginsToRewire: [
          { name: "plugin-a", marketplace: "market-1", toolIds: ["claude" as AiToolId] },
        ],
      });
      const b = new MigrationPlan({
        ...BASE_PARAMS,
        pluginsToRewire: [
          { name: "plugin-a", marketplace: "market-2", toolIds: ["claude" as AiToolId] },
        ],
      });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when plugin toolIds differ but same length", () => {
      const a = new MigrationPlan({
        ...BASE_PARAMS,
        pluginsToRewire: [
          { name: "plugin-a", marketplace: "market", toolIds: ["claude" as AiToolId] },
        ],
      });
      const b = new MigrationPlan({
        ...BASE_PARAMS,
        pluginsToRewire: [
          { name: "plugin-a", marketplace: "market", toolIds: ["cursor" as AiToolId] },
        ],
      });
      expect(a.equals(b)).toBe(false);
    });

    it("returns false when fieldsToStrip arrays have same length but different values", () => {
      const a = new MigrationPlan({ ...BASE_PARAMS, fieldsToStrip: ["mode"] });
      const b = new MigrationPlan({ ...BASE_PARAMS, fieldsToStrip: ["docs"] });
      expect(a.equals(b)).toBe(false);
    });
  });
});
