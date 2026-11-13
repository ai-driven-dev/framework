/**
 * A BSD `sed -i -E` leaves a `<file>-E` backup beside the file it edited. No gate reads that
 * extension, so a committed backup ships as dead code. `src/` holds source and the glossaries
 * that sit beside it, nothing else.
 */
import { readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, canonicalPath, SRC } from "./helpers.js";

const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([".ts", ".md"]);

function filesOutsideTheAllowedList(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesOutsideTheAllowedList(path);
    return ALLOWED_EXTENSIONS.has(extname(entry.name))
      ? []
      : [canonicalPath(path.slice(CLI_ROOT.length + 1))];
  });
}

describe("src/ holds only source", () => {
  it("has no file with an extension outside .ts and .md", () => {
    expect(
      filesOutsideTheAllowedList(SRC),
      "a stray file under src/, such as a sed backup, delete it"
    ).toEqual([]);
  });
});
