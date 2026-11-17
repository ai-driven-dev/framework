/**
 * The composition folder is the one place every context is wired. It holds the root, the shared
 * adapters and one module per context, so a context with no module is not wired and a module
 * with no context is wiring nobody asked for. Subfolders (scenario assembly) are not modules.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SRC, sourceFiles } from "./helpers.js";

const COMPOSITION_DIR = "src/composition";
const FIXED_MODULES = ["container", "shared"];

function modulesIn(files: readonly string[], dir: string): string[] {
  return files
    .filter((file) => file.startsWith(`${dir}/`) && !file.slice(dir.length + 1).includes("/"))
    .map((file) => file.slice(dir.length + 1).replace(/\.ts$/, ""))
    .sort();
}

function contextNames(): string[] {
  return readdirSync(join(SRC, "contexts"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function expectedModules(contexts: readonly string[]): string[] {
  return [...FIXED_MODULES, ...contexts].sort();
}

function layoutViolations(actual: readonly string[], expected: readonly string[]): string[] {
  const missing = expected.filter((name) => !actual.includes(name));
  const extra = actual.filter((name) => !expected.includes(name));
  return [
    ...(missing.length > 0 ? [`missing modules: ${missing.join(", ")}`] : []),
    ...(extra.length > 0 ? [`extra modules: ${extra.join(", ")}`] : []),
  ];
}

describe("composition holds one module per context", () => {
  it("holds the root, the shared module and one module per context, nothing else", () => {
    const violations = layoutViolations(
      modulesIn(sourceFiles(), COMPOSITION_DIR),
      expectedModules(contextNames())
    );

    expect(
      violations,
      "composition must hold exactly container, shared and one per context"
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

  it("ignores files inside subfolders", () => {
    const files = ["src/composition/container.ts", "src/composition/orchestration/setup.ts"];

    expect(modulesIn(files, COMPOSITION_DIR)).toEqual(["container"]);
  });
});
