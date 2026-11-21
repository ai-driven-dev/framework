/**
 * Spawning a process is an adapter's job: `node:child_process` is imported only from an
 * `infrastructure/` folder or from `presentation/terminal/`, the presentation's own adapters
 * (the `adapter` kind in `kind-table.ts`).
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./source-graph.js";

const STATIC_IMPORT = /^(?:\} from|import(?: [^;]*? from)?) ["'](?:node:)?child_process["']/m;
const DYNAMIC_IMPORT = /(?<![\w"'`])import\(\s*["'](?:node:)?child_process["']\s*\)/;

function importsChildProcess(text: string): boolean {
  return STATIC_IMPORT.test(text) || DYNAMIC_IMPORT.test(text);
}

function inAdapterFolder(file: string): boolean {
  return (
    file.split("/").includes("infrastructure") || file.startsWith("src/presentation/terminal/")
  );
}

describe("child_process owner", () => {
  it("sees a static and a dynamic import, and not a mention inside a string", () => {
    expect(importsChildProcess('import { spawn } from "node:child_process";')).toBe(true);
    expect(importsChildProcess('import {\n  spawn,\n} from "child_process";')).toBe(true);
    expect(importsChildProcess('const run = await import("node:child_process");')).toBe(true);
    expect(
      importsChildProcess("const code = 'import { spawn } from \"node:child_process\";';")
    ).toBe(false);
  });

  it("keeps every import of child_process in an adapter folder", () => {
    const outside = sourceFiles()
      .filter((file) => !inAdapterFolder(file))
      .filter((file) => importsChildProcess(read(file)));

    expect(outside).toEqual([]);
  });
});
