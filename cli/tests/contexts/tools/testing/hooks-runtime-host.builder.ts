import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { expect, vi } from "vitest";
import {
  type CapturedSample,
  capturedSample,
  capturedSamples,
  SCRUBBED_PROJECT,
} from "./hook-payload-captures.builder.js";

// Beside this package, never the repository's: a mutation run mutates its own copy.
export const RUNTIME = join(import.meta.dirname, "..", "..", "..", "..", "assets", "hooks-runtime");
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
  ownFolder(folder: string, create: boolean): boolean;
  hooksFolder(name: string, create: boolean): string | null;
}

export function samples(file: string): readonly CapturedSample[] {
  return capturedSamples(file);
}

export function sample(file: string, index: number): CapturedSample {
  return capturedSample(file, (_, at) => at === index, `sample ${index}`);
}

/** A fresh copy of the adapter, as each hook process loads it once. */
export function load(host: string): Adapter {
  const path = join(RUNTIME, `host-${host}.cjs`);
  delete require.cache[require.resolve(path)];
  return require(path) as Adapter;
}

/** What the adapter printed since the last `restoreHostIo`. */
export const printed: string[] = [];
/** What it wrote to standard error over the same span. */
export const printedErr: string[] = [];
const exitCodeBefore = process.exitCode;

/** Puts back the spied reads and writes, the exit code, and forgets what was printed. */
export function restoreHostIo(): void {
  vi.restoreAllMocks();
  printed.length = 0;
  printedErr.length = 0;
  process.exitCode = exitCodeBefore;
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
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    printedErr.push(String(chunk));
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

export const CWD = SCRUBBED_PROJECT;
// The adapters resolve a path against the session folder, which gives a drive-rooted path on Windows.
export const at = (relative: string): string => resolve(CWD, relative);
export const NOTES = at("notes.md");
