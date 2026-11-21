/**
 * A file under `src/` or `tests/` is named in kebab-case: each dot-separated part is lowercase
 * words joined by hyphens, as in `remove-plugin.use-case.unit.test.ts`. Fixtures and golden
 * snapshots hold data named by what they capture, so they are out of scope.
 */
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, canonicalPath } from "./source-graph.js";

const KEBAB_PART = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const OUT_OF_SCOPE = /(^|\/)(fixtures|snapshots)\//;

function isKebabFileName(path: string): boolean {
  const parts = basename(path).split(".");
  return parts.length > 1 && parts.every((part) => KEBAB_PART.test(part));
}

function namedFiles(dir: string): string[] {
  return readdirSync(join(CLI_ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      canonicalPath(join(dir, entry.parentPath.slice(join(CLI_ROOT, dir).length), entry.name))
    )
    .filter((path) => !OUT_OF_SCOPE.test(path));
}

describe("file names", () => {
  it("accepts kebab-case parts and refuses a capital, an underscore or a camel case", () => {
    expect(["a/remove-plugin.use-case.unit.test.ts", "a/x1.d.ts"].every(isKebabFileName)).toBe(
      true
    );
    expect(
      ["a/RemovePlugin.ts", "a/remove_plugin.ts", "a/removePlugin.ts", "a/-x.ts"].filter(
        isKebabFileName
      )
    ).toEqual([]);
  });

  it("holds every file under src and tests to kebab-case", () => {
    const files = [...namedFiles("src"), ...namedFiles("tests")];

    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((path) => !isKebabFileName(path))).toEqual([]);
  });
});
