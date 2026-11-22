import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnCliCommand } from "../../../src/presentation/terminal/child-command.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "aidd-child-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** A script that exits with the number its first argument spells. */
async function entryExitingWithFirstArgument(): Promise<string> {
  const entry = join(dir, "entry.cjs");
  await writeFile(entry, "process.exit(Number(process.argv[2]));\n");
  return entry;
}

describe("spawning a command of the CLI", () => {
  it("runs the entry with the command as its arguments and answers the exit code", async () => {
    const entry = await entryExitingWithFirstArgument();

    expect(await spawnCliCommand(["3"], { execPath: process.execPath, entry })).toBe(3);
  });

  it("answers 0 when the child succeeds", async () => {
    const entry = await entryExitingWithFirstArgument();

    expect(await spawnCliCommand(["0"], { execPath: process.execPath, entry })).toBe(0);
  });
});
