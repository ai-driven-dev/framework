import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { expect, vi } from "vitest";

const MANAGERS = ["npm", "pnpm", "yarn", "bun"];

export interface StubMachine {
  /** The whole environment: its `PATH` is the stub directory and nothing else. */
  readonly env: NodeJS.ProcessEnv;
  /** The package manager commands the stubs ran, in order. */
  commandsRun(): Promise<string[]>;
  /** What the adapter wrote to the process's stderr. */
  stderrEchoed(): string[];
  dispose(): Promise<void>;
}

export interface StubMachineOptions {
  /** The lookup that answers; the other does not exist. */
  lookup: "which" | "where";
  /** What the lookup prints, one line per match; null when `aidd` is nowhere. */
  found: string | null;
  /** What every manager prints to stderr before failing; null when they succeed. */
  stderr: string | null;
}

/** Shell builtins only: the directory is the whole `PATH`, so `cat` is out of reach too. */
const lookupScript = (dir: string): string =>
  `#!/bin/sh\n[ -r "${dir}/found" ] || exit 1\nwhile IFS= read -r line; do printf '%s\\n' "$line"; done < "${dir}/found"\n`;

function managerScript(dir: string, name: string, stderr: string | null): string {
  const failure = stderr === null ? "" : `echo "${stderr}" >&2\nexit 1\n`;
  return `#!/bin/sh\necho "${name} $*" >> "${dir}/log"\n${failure}`;
}

/** A machine whose lookup and package managers are scripts in a directory that is the whole
 * `PATH`, never a real manager. Before it is handed out it proves that: a tool that resolved
 * elsewhere would be a real one, and an install would be real. */
export async function aStubMachine(options: StubMachineOptions): Promise<StubMachine> {
  const dir = await mkdtemp(join(tmpdir(), "aidd-update-installer-"));
  const write = (name: string, body: string) => writeFile(join(dir, name), body, { mode: 0o755 });
  await write(options.lookup, lookupScript(dir));
  for (const name of MANAGERS) await write(name, managerScript(dir, name, options.stderr));
  if (options.found !== null) await writeFile(join(dir, "found"), options.found);
  const env = { PATH: dir };
  const tools = [options.lookup, ...MANAGERS];
  const resolved = execFileSync(
    "/bin/sh",
    ["-c", `for tool in ${tools.join(" ")}; do command -v "$tool"; done`],
    { env, encoding: "utf8" }
  )
    .trim()
    .split("\n");
  expect(resolved).toHaveLength(tools.length);
  for (const found of resolved) expect(found.startsWith(dir + sep)).toBe(true);
  const echo = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  return {
    env,
    commandsRun: async () =>
      (await readFile(join(dir, "log"), "utf8").catch(() => "")).split("\n").filter(Boolean),
    stderrEchoed: () => echo.mock.calls.map(([chunk]) => String(chunk)),
    dispose: async () => {
      echo.mockRestore();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
