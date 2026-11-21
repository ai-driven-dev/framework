import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "../shared/testing/cli-sandbox.builder.js";
import { expectGolden } from "./testing/expect-golden.builder.js";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const SNAPSHOT_FILE = join(ROOT, "tests/golden/snapshots/help/surface.json");

/** One node of the command tree: how it is invoked, and what its help prints. */
interface HelpEntry {
  invocation: string;
  exitCode: number;
  help: string;
}

/** Strip what differs between machines and releases: the version in the root help, and the
 * absolute paths in default-value hints. */
function normalize(text: string): string {
  return text
    .replace(/\b\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?\b/g, "<VERSION>")
    .replace(/\/[^\s"',]+\/aidd-e2e-[^\s"',]*/g, "<TMP>")
    .replace(/\/Users\/[^\s"',/]+/g, "<HOME>")
    .replace(/\r\n/g, "\n")
    .trimEnd();
}

const indentOf = (line: string) => line.length - line.trimStart().length;

/** The command a line names, when it sits at the command column and is not `help`. */
function commandNamed(line: string, indent: number): string[] {
  if (indentOf(line) !== indent) return [];
  const match = /^\s+([a-z][a-z-]*)(?:\||\s|$)/.exec(line);
  return match && match[1] !== "help" ? [match[1]] : [];
}

/** Commander wraps a long description past the name column, so only lines at the first entry's
 * exact indentation are commands - reading a wrapped word as one hangs on the interactive menu. */
function subcommandsOf(help: string): string[] {
  const lines = help.split("\n");
  const start = lines.findIndex((line) => line.trim() === "Commands:");
  if (start === -1) return [];

  const body = lines.slice(start + 1);
  const end = body.findIndex((line) => line.trim() === "");
  const entries = end === -1 ? body : body.slice(0, end);
  if (entries.length === 0) return [];

  const indent = indentOf(entries[0]);
  return entries.flatMap((line) => commandNamed(line, indent));
}

/** Depth-first walk of the command tree, capturing each node's help. */
async function captureTree(cwd: string, fakeHome: string): Promise<HelpEntry[]> {
  const entries: HelpEntry[] = [];

  const visit = async (path: string[]): Promise<void> => {
    const args = [...path, "--help"];
    const { stdout, stderr, exitCode } = await runCli(args, cwd, fakeHome);
    const help = normalize(stdout || stderr);
    entries.push({ invocation: ["aidd", ...path].join(" "), exitCode, help });

    for (const child of subcommandsOf(help)) await visit([...path, child]);
  };

  await visit([]);
  return entries.sort((a, b) => a.invocation.localeCompare(b.invocation));
}

describe("help surface", () => {
  it("matches the stored command tree", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-surface");
    try {
      const captured = await captureTree(projectDir, fakeHome);

      await expectGolden(SNAPSHOT_FILE, captured);
    } finally {
      await cleanup();
    }
  }, 120000);

  // The build embeds only `version` from the manifest, and the tree above masks it.
  it("prints the manifest version", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-version");
    try {
      const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
      const { stdout } = await runCli(["--version"], projectDir, fakeHome);

      expect(stdout.split(" ")[0]).toBe(`aidd/${version}`);
    } finally {
      await cleanup();
    }
  });
});
