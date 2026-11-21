/**
 * Spawning a process is an adapter's job: `node:child_process` is imported only from a file of
 * the `adapter` kind in `kind-table.ts`. This is not the single owner target 08 asks for: several
 * adapters import it today.
 */
import { describe, expect, it } from "vitest";
import { kindsOf } from "./kinds.js";
import { read, sourceFiles } from "./source-graph.js";

const STATIC_IMPORT = /^(?:\} from|import(?: [^;]*? from)?) ["'](?:node:)?child_process["']/m;
const DYNAMIC_IMPORT = /(?<![\w"'`])import\(\s*["'](?:node:)?child_process["']\s*\)/;

function importsChildProcess(text: string): boolean {
  return STATIC_IMPORT.test(text) || DYNAMIC_IMPORT.test(text);
}

const inAdapterFolder = (file: string): boolean => kindsOf(file).includes("adapter");

describe("child_process owner", () => {
  it("sees a static and a dynamic import, and not a mention inside a string", () => {
    expect(importsChildProcess('import { spawn } from "node:child_process";')).toBe(true);
    expect(importsChildProcess('import {\n  spawn,\n} from "child_process";')).toBe(true);
    expect(importsChildProcess('const run = await import("node:child_process");')).toBe(true);
    expect(
      importsChildProcess("const code = 'import { spawn } from \"node:child_process\";';")
    ).toBe(false);
  });

  it("accepts an adapter file and rejects an application file and a controller", () => {
    expect(inAdapterFolder("src/presentation/terminal/child-command.ts")).toBe(true);
    expect(inAdapterFolder("src/contexts/x/infrastructure/runner.adapter.ts")).toBe(true);
    expect(inAdapterFolder("src/contexts/x/application/run.use-case.ts")).toBe(false);
    expect(inAdapterFolder("src/presentation/controllers/run.controller.ts")).toBe(false);
  });

  it("keeps every import of child_process in an adapter folder", () => {
    const outside = sourceFiles()
      .filter((file) => !inAdapterFolder(file))
      .filter((file) => importsChildProcess(read(file)));

    expect(outside).toEqual([]);
  });
});
