import { copyFile, link, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { vi } from "vitest";

/** What the stub does when it is run. Without a field it prints nothing and exits 0. */
export interface StubBehaviour {
  readonly stdout?: string;
  /** Printed instead of `stdout` when the first argument is a key of it. */
  readonly stdoutByCommand?: Readonly<Record<string, string>>;
  readonly stderr?: string;
  readonly status?: number;
  /** Ends the process with a signal, so it leaves no exit code. POSIX only: Windows has no signals. */
  readonly killed?: boolean;
  /** Never answers, so only the caller's timeout ends it. */
  readonly hangs?: boolean;
}

export interface StubBinary {
  /** The argument list of each run, in order. */
  invocations(): Promise<string[][]>;
  dispose(): Promise<void>;
}

/**
 * Runs inside the stub before node reads its arguments. Node resolves the first argument against
 * the working directory, so a relative one is handed back as it was written.
 */
const STUB_MODULE = `
import { appendFileSync, writeSync } from "node:fs";
import { isAbsolute, relative } from "node:path";

const { log, behaviour } = JSON.parse(process.env.AIDD_STUB);
const [, first, ...rest] = process.argv;
const asWritten = relative(process.cwd(), first);
const args = [asWritten.startsWith("..") || isAbsolute(asWritten) ? first : asWritten, ...rest];

appendFileSync(log, args.join("|") + "\\n");
writeSync(1, behaviour.stdoutByCommand?.[args[0]] ?? behaviour.stdout ?? "");
writeSync(2, behaviour.stderr ?? "");
if (behaviour.killed) process.kill(process.pid, "SIGKILL");
if (behaviour.hangs) {
  setInterval(() => {}, 1000);
  await new Promise(() => {});
}
process.exit(behaviour.status ?? 0);
`;

/** Links the running node under `target`, so the file is a real executable on every platform. */
async function cloneNode(target: string): Promise<void> {
  await link(process.execPath, target).catch(() => copyFile(process.execPath, target));
}

/**
 * A machine whose `PATH` is one temp directory. It holds an executable named `name`, a copy of the
 * running node preloaded with a stub that behaves as told, or nothing at all when `behaviour` is
 * null, so the command is absent. It resolves without a shell on POSIX and on Windows. No real
 * binary is reachable, and the environment is restored on `dispose`.
 */
export async function aMachineWith(
  name: string,
  behaviour: StubBehaviour | null
): Promise<StubBinary> {
  const dir = await mkdtemp(join(tmpdir(), "aidd-stub-binary-"));
  const log = join(dir, "log");
  if (behaviour !== null) {
    const stub = join(dir, "stub.mjs");
    await writeFile(stub, STUB_MODULE);
    await cloneNode(join(dir, process.platform === "win32" ? `${name}.exe` : name));
    vi.stubEnv("AIDD_STUB", JSON.stringify({ log, behaviour }));
    vi.stubEnv("NODE_OPTIONS", `--import ${pathToFileURL(stub).href}`);
  }
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
