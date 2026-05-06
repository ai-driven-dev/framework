import { describe, expect, it } from "vitest";
import type { MigrationPlanParams } from "../../../src/domain/models/migration-plan.js";
import { MigrationPlan } from "../../../src/domain/models/migration-plan.js";
import type { AiToolId } from "../../../src/domain/models/tool-ids.js";

function rewire(name: string, toolIds: AiToolId[]) {
  return { name, marketplace: "aidd-framework", toolIds } as const;
}

const BASE_PARAMS: MigrationPlanParams = {
  fromVersion: 5,
  fieldsToStrip: [],
  filesToDelete: [],
  pluginsToRewire: [],
  defaultMarketplaceMissing: false,
  userMemoryFiles: ["CLAUDE.md", "AGENTS.md"],
};

describe("MigrationPlan", () => {
  describe("constructor validation", () => {
    it("accepts valid fromVersion values", () => {
      for (const v of [1, 2, 3, 4, 5]) {
        expect(() => new MigrationPlan({ ...BASE_PARAMS, fromVersion: v })).not.toThrow();
      }
    });

    it("throws on invalid fromVersion", () => {
      expect(() => new MigrationPlan({ ...BASE_PARAMS, fromVersion: 0 })).toThrow();
      expect(() => new MigrationPlan({ ...BASE_PARAMS, fromVersion: 6 })).toThrow();
    });

    it("toVersion is always 5", () => {
      const plan = new MigrationPlan(BASE_PARAMS);
      expect(plan.toVersion).toBe(5);
    });
  });

  describe("isNoOp()", () => {
    it("returns true for clean v5 manifest with default marketplace", () => {
      const plan = new MigrationPlan(BASE_PARAMS);
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
      expect(plan.describe()).toContain("v4 → v5");
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
  });
});
