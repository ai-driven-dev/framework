import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { expect, vi } from "vitest";
import { wireTelemetry } from "../../../../src/composition/telemetry.js";
import type { TelemetryDeps } from "../../../../src/presentation/deps.js";
import { git, initRepository } from "../../../helpers/git-sandbox.js";
import { REPOSITORY_ROOT } from "../../../helpers/repository-root.js";
import {
  createTelemetrySandbox,
  type TelemetrySandbox,
} from "../../../helpers/telemetry-sandbox.js";

/** One predicate, one table: a call is stored only if its directory was seen alive belonging to
 * clone X, X had an open consent interval at the call's time, and `AIDD_TELEMETRY=0` is not set.
 * Measurement starts at `on`: nothing before it is ever stored. Every row runs real git repositories in a temporary directory, the
 * real adapters and a real ingest, and states which calls end up in the ledger. A row that
 * expects a call not to be stored always holds a control that must be: a row cannot pass because
 * ingest stored nothing at all.
 *
 * Time is a number of seconds from `base`. Only `Date` is faked, and the base is the real now,
 * because a clone's birth time is the file system's. A call that must predate a clone born in
 * the row is placed before `base`; one that must follow it, well after. */

export const SHARED = "git@github.com:acme/shared.git";
export const OTHER = "git@github.com:acme/other.git";
export const BEFORE = -50_000;
export const HOUR = 3_600;
export const SESSION = "00000000-0000-4000-8000-000000000001";
export const GATE = join(REPOSITORY_ROOT, "plugins", "aidd-telemetry", "hooks", "prompt-gate.cjs");
export const FAKE_AIDD = "process.exit(0);\n";

/** A stand-in `aidd` the way the hook looks it up on `PATH`. Windows only tries `PATHEXT`
 * extensions, so a bare file is never found and the machine's own `aidd` answers instead; a
 * `.cmd` with its CLI entry beside it is run with this node, not through cmd.exe. */
export function writeAiddStandIn(bin: string): void {
  mkdirSync(bin, { recursive: true });
  if (process.platform === "win32") {
    const entry = join(bin, "node_modules", "@ai-driven-dev", "cli", "dist", "cli.js");
    mkdirSync(dirname(entry), { recursive: true });
    writeFileSync(entry, FAKE_AIDD);
    writeFileSync(join(bin, "aidd.cmd"), `@"${process.execPath}" "${entry}" %*\r\n`);
    return;
  }
  writeFileSync(join(bin, "aidd"), `#!${process.execPath}\n${FAKE_AIDD}`);
  chmodSync(join(bin, "aidd"), 0o755);
}

let box: TelemetrySandbox;
let deps: TelemetryDeps;
let base: number;
let calls = 0;

export class World {
  constructor(readonly sandbox: TelemetrySandbox) {}

  get deps(): TelemetryDeps {
    return deps;
  }

  /** Wires the commands again, as a second process would. */
  rewire(): void {
    deps = wireTelemetry(() => this.sandbox.home);
  }

  at(seconds: number): void {
    vi.setSystemTime(base + seconds * 1000);
  }

  /** A repository with a first commit, on `main` or on `branch`; `remote` is its `origin`, none
   * when null. */
  repository(name: string, remote: string | null, branch = "main"): string {
    const dir = join(this.sandbox.root, name);
    initRepository(dir, this.sandbox.gitEnv, remote === null ? {} : { remote });
    if (branch !== "main") git(dir, this.sandbox.gitEnv, "checkout", "-q", "-b", branch);
    return dir;
  }

  /** The real `prompt-gate.cjs`, as Claude Code would run it in `dir`, with a stand-in `aidd`
   * that can answer `telemetry task`. `attended: false` is a headless session. Returns whether
   * the prompt was blocked. It reads the clock of the machine, not the faked one. */
  blocks(dir: string, attended = true): boolean {
    const bin = join(this.sandbox.root, "bin");
    writeAiddStandIn(bin);
    const env: NodeJS.ProcessEnv = {
      PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      HOME: this.sandbox.home,
      USERPROFILE: this.sandbox.home,
      AIDD_TELEMETRY_DIR: this.sandbox.telemetry,
      CLAUDE_CODE_SESSION_ID: SESSION,
      CLAUDE_CODE_ENTRYPOINT: "cli",
    };
    if (attended) env.CLAUDE_CODE_SESSION_ATTENDED = "1";
    const run = spawnSync(process.execPath, [GATE], {
      cwd: dir,
      env,
      encoding: "utf8",
      input: JSON.stringify({
        session_id: SESSION,
        transcript_path: join(this.sandbox.claude, "projects", "-p", "x.jsonl"),
        cwd: dir,
        prompt: "fix the cart",
        hook_event_name: "UserPromptSubmit",
      }),
    });
    return run.stdout.includes('"decision":"block"');
  }

  /** The consent key set by hand, as a person with git would. */
  key(dir: string, value: string | null): void {
    const args = value === null ? ["--unset"] : [];
    git(
      dir,
      this.sandbox.gitEnv,
      "config",
      "--local",
      ...args,
      "aidd.telemetry",
      ...(value === null ? [] : [value])
    );
  }

  consentsFile(): string {
    return join(this.sandbox.telemetry, "ledger", "consents.jsonl");
  }

  /** One call, in a session file of its own: no batch ever overwrites an earlier one. */
  call(cwd: string, id: string, seconds: number): void {
    calls += 1;
    const file = join(this.sandbox.claude, "projects", "-p", `session-${calls}.jsonl`);
    mkdirSync(join(this.sandbox.claude, "projects", "-p"), { recursive: true });
    writeFileSync(
      file,
      `${JSON.stringify({
        type: "assistant",
        sessionId: `session-${calls}`,
        requestId: `req_${id}`,
        timestamp: new Date(base + seconds * 1000).toISOString(),
        version: "2.1.0",
        cwd,
        gitBranch: "main",
        message: {
          id: `msg_${id}`,
          model: "m",
          usage: {
            input_tokens: 1,
            output_tokens: 10,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        },
      })}\n`
    );
    // Written when the call was made, as Claude writes its transcripts.
    const written = new Date(base + seconds * 1000);
    utimesSync(file, written, written);
  }

  async on(dir: string, seconds: number) {
    this.at(seconds);
    return deps.enableTelemetry.execute({ cwd: dir, choice: "keep" });
  }

  async off(dir: string, seconds: number) {
    this.at(seconds);
    return deps.disableTelemetry.execute({ cwd: dir });
  }

  /** The last line of the consent log cut short, as a crash in the middle of a write would. */
  cutLastConsentLine(): void {
    const lines = readFileSync(this.consentsFile(), "utf8").split("\n").filter(Boolean);
    lines[lines.length - 1] = (lines[lines.length - 1] ?? "").slice(0, 40);
    writeFileSync(this.consentsFile(), `${lines.join("\n")}\n`);
  }

  async ingest(seconds: number) {
    this.at(seconds);
    return deps.ingestUsage.execute();
  }

  /** The ids of the calls the ledger holds. */
  stored(): string[] {
    const dir = join(this.sandbox.telemetry, "ledger");
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((name) => /^\d{4}-\d{2}-\d{2}\.jsonl$/u.test(name))
      .flatMap((name) => readFileSync(join(dir, name), "utf8").split("\n"))
      .filter((line) => line !== "")
      .map((line) => String(JSON.parse(line).key).replace(/^msg_(.+):req_.*$/u, "$1"))
      .sort();
  }

  /** The clone is moved out of the way rather than deleted: a deleted clone's inode may be given
   * to the next one on some file systems, and a row about a clone told apart from its successor
   * must not depend on that. The path it was at is gone all the same. */
  removeClone(dir: string): void {
    renameSync(dir, `${dir}.removed`);
  }
}

export interface Row {
  readonly n: string;
  readonly scenario: string;
  readonly expected: readonly string[];
  readonly run: (world: World) => Promise<void>;
  /** Locks a directory with `chmod`, which Windows ignores. */
  readonly posixOnly?: true;
}

/** Opens a fresh sandbox, real git, and a faked clock; pair with `stopWorld`. */
export function startWorld(): void {
  box = createTelemetrySandbox();
  for (const [name, value] of Object.entries(box.env())) vi.stubEnv(name, value);
  deps = wireTelemetry(() => box.home);
  base = Date.now();
  calls = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(base);
}

export function stopWorld(): void {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(box.root, { recursive: true, force: true });
}

/** The world a row runs in, and the check every row shares. */
export async function checkRow(row: Row): Promise<void> {
  await row.run(new World(box));
  expect(new World(box).stored()).toEqual([...row.expected]);
}
