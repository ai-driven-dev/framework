import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { expect, vi } from "vitest";
import { REPOSITORY_ROOT } from "../../../shared/testing/repository-root.builder.js";

// Beside this package, never the repository's: a mutation run mutates its own copy.
export const RUNTIME = join(import.meta.dirname, "..", "..", "..", "..", "assets", "hooks-runtime");
const PAYLOADS = join(REPOSITORY_ROOT, "scripts", "__tests__", "fixtures", "hook-payloads");
export const HOSTS = [
  "claude",
  "codex",
  "copilot",
  "cursor",
  "antigravity",
  "kiro",
  "bridge",
] as const;

const require = createRequire(import.meta.url);
export const fs = require("node:fs") as typeof import("node:fs");

interface NeutralEvent {
  readonly host: string;
  readonly event: string;
  readonly files: readonly { readonly path: string; readonly content?: string }[];
  readonly command?: string;
  readonly stopActive: boolean;
  readonly sessionId: string | null;
  readonly cwd: string;
  readonly raw: unknown;
}

interface Adapter {
  readEvent(): NeutralEvent | undefined;
  answer(answer: { level: 1 | 2; text?: string; person?: string }): void;
  continueTurn(text: string): void;
  refuse(reason: string): void;
}

interface Sample {
  readonly run: string;
  readonly payload: Record<string, unknown>;
  readonly hookAnswer: Record<string, unknown> | null;
}

function samples(file: string): readonly Sample[] {
  return (JSON.parse(readFileSync(join(PAYLOADS, file), "utf8")) as { samples: Sample[] }).samples;
}

export function sample(file: string, index: number): Sample {
  const found = samples(file)[index];
  if (found === undefined) throw new Error(`${file} has no sample ${index}`);
  return found;
}

/** A fresh copy of the adapter, as each hook process loads it once. */
export function load(host: string): Adapter {
  const path = join(RUNTIME, `host-${host}.cjs`);
  delete require.cache[require.resolve(path)];
  return require(path) as Adapter;
}

/** What the adapter printed since the last `restoreHostIo`. */
export const printed: string[] = [];

/** Puts back the spied reads and writes, and forgets what was printed. */
export function restoreHostIo(): void {
  vi.restoreAllMocks();
  printed.length = 0;
}

/** Hands the adapter `stdin` as the host would, and collects what it prints. */
export function given(stdin: string): void {
  const original = fs.readFileSync;
  vi.spyOn(fs, "readFileSync").mockImplementation(((file: unknown, ...rest: unknown[]) =>
    file === 0
      ? stdin
      : (original as (...args: unknown[]) => unknown)(file, ...rest)) as typeof fs.readFileSync);
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    printed.push(String(chunk));
    return true;
  });
}

export function read(host: string, payload: unknown): { adapter: Adapter; event?: NeutralEvent } {
  const adapter = load(host);
  given(JSON.stringify(payload));
  return { adapter, event: adapter.readEvent() };
}

export function output(): unknown {
  expect(printed).toHaveLength(1);
  return JSON.parse(printed[0] as string);
}

export const CWD = "/Users/user/project";
// The adapters resolve a path against the session folder, which gives a drive-rooted path on Windows.
export const at = (relative: string): string => resolve(CWD, relative);
export const SESSION = "00000000-0000-4000-8000-000000000000";
export const NOTES = at("notes.md");
