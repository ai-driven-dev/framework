/**
 * A host binary (an AI host CLI such as claude, codex or copilot) is spawned only from
 * `host-registration/infrastructure`. A host binary is any name a tool profile declares as
 * `binary:`, so a new host is covered with no list to edit. Other child processes (git, gh,
 * icacls, the package manager, the CLI itself) are not hosts and may run from any adapter.
 * Limit: a binary name built at run time, not written as a literal, is not seen.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./source-graph.js";

const STATIC_IMPORT = /^(?:\} from|import(?: [^;]*? from)?) ["'](?:node:)?child_process["']/m;
const DYNAMIC_IMPORT = /(?<![\w"'`])import\(\s*["'](?:node:)?child_process["']\s*\)/;
const OWNER = "src/contexts/host-registration/infrastructure/";
const PROFILES = "src/composition/tool-profiles/";

function importsChildProcess(text: string): boolean {
  return STATIC_IMPORT.test(text) || DYNAMIC_IMPORT.test(text);
}

function declaredBinaries(profileTexts: readonly string[]): string[] {
  return profileTexts.flatMap((text) =>
    [...text.matchAll(/\bbinary:\s*["']([\w-]+)["']/g)].flatMap((match) => match.slice(1, 2))
  );
}

function hostSpawnsOutside(
  files: Readonly<Record<string, string>>,
  binaries: readonly string[]
): string[] {
  return Object.entries(files)
    .filter(([file]) => !file.startsWith(OWNER))
    .filter(([, text]) => importsChildProcess(text))
    .filter(([, text]) => binaries.some((binary) => new RegExp(`["'\`]${binary}["'\`]`).test(text)))
    .map(([file]) => file);
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

  it("reads the host binaries from the tool profiles", () => {
    expect(declaredBinaries(['const A = {\n  binary: "claude",\n};', "binary: 'codex'"])).toEqual([
      "claude",
      "codex",
    ]);
  });

  it("rejects a host binary spawned outside host-registration infrastructure", () => {
    const planted = {
      [`${OWNER}host-cli-adapter.ts`]:
        'import { spawnSync } from "node:child_process";\nspawnSync("claude");',
      "src/contexts/x/infrastructure/runner.adapter.ts":
        'import { spawnSync } from "node:child_process";\nspawnSync("claude", ["--version"]);',
      "src/contexts/y/infrastructure/git.adapter.ts":
        'import { spawnSync } from "node:child_process";\nspawnSync("git");',
      "src/contexts/z/domain/name.ts": 'export const NAME = "claude";',
    };

    expect(hostSpawnsOutside(planted, ["claude"])).toEqual([
      "src/contexts/x/infrastructure/runner.adapter.ts",
    ]);
  });

  it("spawns no host binary outside host-registration infrastructure", () => {
    const profiles = sourceFiles().filter((file) => file.startsWith(PROFILES));
    const binaries = declaredBinaries(profiles.map(read));
    const files = Object.fromEntries(sourceFiles().map((file) => [file, read(file)]));

    expect(binaries.length).toBeGreaterThan(0);
    expect(hostSpawnsOutside(files, binaries)).toEqual([]);
  });
});
