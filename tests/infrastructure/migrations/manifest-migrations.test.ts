import { describe, expect, it } from "vitest";
import {
  CURRENT_MANIFEST_VERSION,
  MANIFEST_MIGRATIONS,
  type ManifestMigration,
  applyMigrations,
} from "../../../src/infrastructure/migrations/manifest-migrations.js";

describe("applyMigrations()", () => {
  it("manifest without version (v0) is migrated to v1", () => {
    const input = { tools: {}, docs: null, docsDir: "aidd_docs" };
    const result = applyMigrations(input);
    expect(result.version).toBe(1);
  });

  it("manifest with current version is returned unchanged", () => {
    const input = {
      version: CURRENT_MANIFEST_VERSION,
      tools: {},
      docs: null,
      docsDir: "aidd_docs",
    };
    const result = applyMigrations(input);
    expect(result).toBe(input); // same reference = no copy
  });

  it("preserves existing data during migration", () => {
    const input = { tools: { claude: {} }, docs: null, docsDir: "custom" };
    const result = applyMigrations(input);
    expect(result.docsDir).toBe("custom");
    expect(result.tools).toEqual({ claude: {} });
    expect(result.version).toBe(1);
  });

  it("multiple sequential migrations applied in order", () => {
    const chainedMigrations: ManifestMigration[] = [
      {
        fromVersion: 0,
        toVersion: 1,
        migrate(data) {
          return { ...data, version: 1 };
        },
      },
      {
        fromVersion: 1,
        toVersion: 2,
        migrate(data) {
          return { ...data, version: 2, testField: "added" };
        },
      },
    ];

    const input = { tools: {}, docs: null, docsDir: "aidd_docs" };
    const result = applyMigrations(input, undefined, chainedMigrations);

    expect(result.version).toBe(2);
    expect(result.testField).toBe("added");
  });

  it("wraps migration error with version context", () => {
    const failingMigrations: ManifestMigration[] = [
      {
        fromVersion: 0,
        toVersion: 1,
        migrate(_data) {
          throw new Error("disk full");
        },
      },
    ];

    const input = { tools: {}, docs: null };

    expect(() => applyMigrations(input, undefined, failingMigrations)).toThrow(
      "Manifest migration failed from version 0 to 1"
    );
  });
});
