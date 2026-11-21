/**
 * Spawning a process is an adapter's job: `node:child_process` is imported only from an
 * `infrastructure/` folder. The files outside one today are listed and may not grow; one that
 * moves or goes away must come off the list, so it only ever gets shorter.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./source-graph.js";

/** Files outside `infrastructure/` that import `node:child_process` today. */
const OUTSIDE_INFRASTRUCTURE: readonly string[] = ["src/presentation/terminal/child-command.ts"];

const STATIC_IMPORT = /^(?:\} from|import(?: [^;]*? from)?) ["'](?:node:)?child_process["']/m;
const DYNAMIC_IMPORT = /(?<![\w"'`])import\(\s*["'](?:node:)?child_process["']\s*\)/;

function importsChildProcess(text: string): boolean {
  return STATIC_IMPORT.test(text) || DYNAMIC_IMPORT.test(text);
}

function inInfrastructure(file: string): boolean {
  return file.split("/").includes("infrastructure");
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

  it("keeps every import of child_process in infrastructure, or on the list written down for it", () => {
    const outside = sourceFiles()
      .filter((file) => !inInfrastructure(file))
      .filter((file) => importsChildProcess(read(file)));

    expect(outside).toEqual(OUTSIDE_INFRASTRUCTURE);
  });
});
