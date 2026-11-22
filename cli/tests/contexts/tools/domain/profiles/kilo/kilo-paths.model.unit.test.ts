import { describe, expect, it } from "vitest";
import { KILO_OUTPUT_PATH_CANDIDATES } from "../../../../../../src/contexts/tools/domain/profiles/kilo/kilo-paths.model.js";
import { chooseOutputPath } from "../../../../../../src/contexts/tools/domain/sections/mcp-section.js";
import { DualConfigError } from "../../../../../../src/contexts/tools/domain/tools.error.js";

const existing =
  (...paths: string[]) =>
  (path: string): boolean =>
    paths.includes(path);

describe("the kilo config path chosen", () => {
  it.each([
    [[], ".kilo/kilo.jsonc"],
    [["kilo.json"], "kilo.json"],
    [["kilo.jsonc"], "kilo.jsonc"],
    [[".kilo/kilo.json"], ".kilo/kilo.json"],
    [[".kilo/kilo.jsonc"], ".kilo/kilo.jsonc"],
    [["kilo.json", ".kilo/kilo.jsonc"], ".kilo/kilo.jsonc"],
  ])("with %j on disk, writes %s", (found, chosen) => {
    expect(chooseOutputPath(KILO_OUTPUT_PATH_CANDIDATES, existing(...found))).toBe(chosen);
  });

  it.each([[[".kilo/kilo.json", ".kilo/kilo.jsonc"]], [["kilo.json", "kilo.jsonc"]]])(
    "refuses %j, two variants of one tier",
    (found) => {
      expect(() => chooseOutputPath(KILO_OUTPUT_PATH_CANDIDATES, existing(...found))).toThrow(
        DualConfigError
      );
    }
  );
});

describe("KILO_OUTPUT_PATH_CANDIDATES", () => {
  it("lists the project tier before the legacy root tier and falls back to the project jsonc", () => {
    expect(KILO_OUTPUT_PATH_CANDIDATES.tiers).toStrictEqual([
      [".kilo/kilo.json", ".kilo/kilo.jsonc"],
      ["kilo.json", "kilo.jsonc"],
    ]);
    expect(KILO_OUTPUT_PATH_CANDIDATES.fallback).toBe(".kilo/kilo.jsonc");
  });

  it("refuses several files of one tier, naming kilo", () => {
    expect(KILO_OUTPUT_PATH_CANDIDATES.onMultipleCandidates.error.toolId).toBe("kilo");
  });
});
