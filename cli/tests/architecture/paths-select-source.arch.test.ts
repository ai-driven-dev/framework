import { describe, expect, it } from "vitest";
import {
  canonicalPath,
  contextOf,
  importersByFile,
  matchesGlob,
  pluginReadmes,
  resolveImportTarget,
  sourceFiles,
} from "./helpers.js";

describe("architecture paths select the same files on every platform", () => {
  it.each([
    ["src\\contexts\\tools\\domain\\tool.ts", "tools", "src/contexts/**/*.ts"],
    ["src\\kernel\\errors.ts", "kernel", "src/kernel/**/*.ts"],
    ["src\\presentation\\commands\\setup.ts", "presentation", "src/presentation/commands/**"],
  ])("selects the explicit backslash path %s", (nativePath, context, glob) => {
    const file = canonicalPath(nativePath);
    expect(contextOf(file)).toBe(context);
    expect(matchesGlob(glob, file)).toBe(true);
    expect(matchesGlob("src/deleted-context/**", file)).toBe(false);
  });

  it.each([
    ["src\\kernel\\ports\\file-reader.ts", "../file.js"],
    ["src/kernel/ports/file-reader.ts", "..\\file.js"],
    ["src\\runtime\\caller.ts", "@/kernel/file.js"],
  ])("resolves %s importing %s to the canonical source key", (file, specifier) => {
    const known = new Set(["src/kernel/file.ts"]);
    expect(known.has(resolveImportTarget(file, specifier))).toBe(true);
  });

  it("returns canonical, nonempty source and plugin scopes", () => {
    const files = sourceFiles();
    const readmes = pluginReadmes();
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((file) => file.startsWith("src/") && !file.includes("\\"))).toBe(true);
    expect(readmes.length).toBeGreaterThan(0);
    expect(readmes.every((file) => /^plugins\/[^/]+\/README\.md$/.test(file))).toBe(true);
  });

  it("keeps relative-import lookups connected to the source-file keys", () => {
    expect(importersByFile().get("src/kernel/file.ts")).toContain(
      "src/kernel/ports/file-reader.ts"
    );
  });
});
