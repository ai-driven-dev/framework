/**
 * The composition folder is the one place every context is wired. It holds the root, the shared
 * adapters and one module per context, so a context with no module is not wired and a module
 * with no context is wiring nobody asked for. The only subfolder is `orchestration`, which
 * assembles scenarios and is not a module.
 */
import { describe, expect, it } from "vitest";
import { COMPOSITION_DIR, contextNames, sourceFiles } from "./helpers.js";

const FIXED_MODULES = ["container", "shared"];
const ALLOWED_SUBFOLDERS = ["orchestration"];

function modulesIn(files: readonly string[], dir: string): string[] {
  return files
    .filter((file) => file.startsWith(`${dir}/`) && !file.slice(dir.length + 1).includes("/"))
    .map((file) => file.slice(dir.length + 1).replace(/\.ts$/, ""))
    .sort();
}

function subfoldersIn(files: readonly string[], dir: string): string[] {
  const names = files
    .filter((file) => file.startsWith(`${dir}/`) && file.slice(dir.length + 1).includes("/"))
    .map((file) => file.slice(dir.length + 1).split("/")[0] ?? "");
  return [...new Set(names)].sort();
}

function expectedModules(contexts: readonly string[]): string[] {
  return [...FIXED_MODULES, ...contexts].sort();
}

function layoutViolations(
  actual: readonly string[],
  expected: readonly string[],
  subfolders: readonly string[] = []
): string[] {
  const strayFolders = subfolders.filter((name) => !ALLOWED_SUBFOLDERS.includes(name));
  const missing = expected.filter((name) => !actual.includes(name));
  const extra = actual.filter((name) => !expected.includes(name));
  return [
    ...(missing.length > 0 ? [`missing modules: ${missing.join(", ")}`] : []),
    ...(extra.length > 0 ? [`extra modules: ${extra.join(", ")}`] : []),
    ...(strayFolders.length > 0 ? [`unexpected subfolders: ${strayFolders.join(", ")}`] : []),
  ];
}

describe("composition holds one module per context", () => {
  it("holds the root, the shared module and one module per context, nothing else", () => {
    const files = sourceFiles();
    const violations = layoutViolations(
      modulesIn(files, COMPOSITION_DIR),
      expectedModules(contextNames()),
      subfoldersIn(files, COMPOSITION_DIR)
    );

    expect(
      violations,
      "composition must hold exactly container, shared, one per context and orchestration/"
    ).toEqual([]);
  });
});

describe("the guard itself", () => {
  it("names the module a context lacks and the module no context owns", () => {
    const violations = layoutViolations(
      ["container", "shared", "stray", "tools"],
      expectedModules(["tools", "recipes"])
    );

    expect(violations).toEqual(["missing modules: recipes", "extra modules: stray"]);
  });

  it("ignores files inside subfolders when counting modules", () => {
    const files = ["src/composition/container.ts", "src/composition/orchestration/setup.ts"];

    expect(modulesIn(files, COMPOSITION_DIR)).toEqual(["container"]);
  });

  it("names a subfolder that is not orchestration", () => {
    const files = [
      "src/composition/orchestration/setup.ts",
      "src/composition/extras/anything.ts",
      "src/composition/extras/more.ts",
    ];

    expect(layoutViolations([], [], subfoldersIn(files, COMPOSITION_DIR))).toEqual([
      "unexpected subfolders: extras",
    ]);
  });
});
