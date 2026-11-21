import { describe, expect, it } from "vitest";
import {
  chooseKiloConfigPath,
  KILO_OUTPUT_PATH_CANDIDATES,
} from "../../../../../../src/contexts/tools/domain/profiles/kilo/kilo-paths.js";
import { KiloDualConfigError } from "../../../../../../src/contexts/tools/domain/tools.error.js";

const existing =
  (...paths: string[]) =>
  (path: string): boolean =>
    paths.includes(path);

describe("chooseKiloConfigPath", () => {
  it.each([
    [[], ".kilo/kilo.jsonc"],
    [["kilo.json"], "kilo.json"],
    [["kilo.jsonc"], "kilo.jsonc"],
    [[".kilo/kilo.json"], ".kilo/kilo.json"],
    [[".kilo/kilo.jsonc"], ".kilo/kilo.jsonc"],
    [["kilo.json", ".kilo/kilo.jsonc"], ".kilo/kilo.jsonc"],
  ])("with %j on disk, writes %s", (found, chosen) => {
    expect(chooseKiloConfigPath(existing(...found))).toBe(chosen);
  });

  it.each([[[".kilo/kilo.json", ".kilo/kilo.jsonc"]], [["kilo.json", "kilo.jsonc"]]])(
    "refuses %j, two variants of one tier",
    (found) => {
      expect(() => chooseKiloConfigPath(existing(...found))).toThrow(KiloDualConfigError);
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

  it("raises the dual-config error on a conflict", () => {
    expect(() => KILO_OUTPUT_PATH_CANDIDATES.conflict()).toThrow(KiloDualConfigError);
  });
});
