import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

/** What the stub does when it is run. Without a field it prints nothing and exits 0. */
export interface StubBehaviour {
  readonly stdout?: string;
  readonly stderr?: string;
  readonly status?: number;
  /** Ends the process with a signal, so it leaves no exit code. */
  readonly killed?: boolean;
  /** Never answers, so only the caller's timeout ends it. */
  readonly hangs?: boolean;
}

export interface StubBinary {
  /** The argument list of each run, in order. */
  invocations(): Promise<string[][]>;
  dispose(): Promise<void>;
}

const quoted = (text: string): string => `'${text.replaceAll("'", `'\\''`)}'`;

function script(log: string, behaviour: StubBehaviour): string {
  const lines = [
    "#!/bin/sh",
    `IFS='|'; echo "$*" >> ${quoted(log)}`,
    `printf '%s' ${quoted(behaviour.stdout ?? "")}`,
    `printf '%s' ${quoted(behaviour.stderr ?? "")} >&2`,
  ];
  if (behaviour.hangs) lines.push("while :; do :; done");
  if (behaviour.killed) lines.push("kill -9 $$");
  lines.push(`exit ${behaviour.status ?? 0}`);
  return `${lines.join("\n")}\n`;
}

/**
 * A machine whose `PATH` is one temp directory. It holds a script named `name` that behaves as
 * told, or nothing at all when `behaviour` is null, so the command is absent. No real binary is
 * reachable, and the environment is restored on `dispose`.
 */
export async function aMachineWith(
  name: string,
  behaviour: StubBehaviour | null
): Promise<StubBinary> {
  const dir = await mkdtemp(join(tmpdir(), "aidd-stub-binary-"));
  const log = join(dir, "log");
  if (behaviour !== null) await writeFile(join(dir, name), script(log, behaviour), { mode: 0o755 });
  vi.stubEnv("PATH", dir);
  return {
    invocations: async () =>
      (await readFile(log, "utf8").catch(() => ""))
        .split("\n")
        .filter(Boolean)
        .map((line) => line.split("|")),
    dispose: async () => {
      vi.unstubAllEnvs();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
