import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readClaudeUsageLine } from "../../../../../../src/contexts/telemetry/infrastructure/sources/claude/claude-transcript-usage.js";

const FIXTURES = resolve(import.meta.dirname, "../../../../../fixtures/claude-usage/projects");

function journalLines(): string[] {
  const files = readdirSync(FIXTURES, { recursive: true, encoding: "utf8" })
    .filter((path) => path.includes(".jsonl"))
    .sort();
  return files.flatMap((path) =>
    readFileSync(join(FIXTURES, path), "utf8").split("\n").filter(Boolean)
  );
}

function firstRecordOfVersion(version: string) {
  for (const line of journalLines()) {
    if (!line.includes(`"version":"${version}"`)) continue;
    const [first] = readClaudeUsageLine(line).records;
    if (first) return first;
  }
  throw new Error(`no journal record of version ${version}`);
}

describe("the Claude journal as each observed tool version writes it", () => {
  it.each([
    ["2.1.290", { input: 7, output: 70, cache_read: 0, cache_write: 10, cache_write_1h: 0 }],
    ["2.1.292", { input: 3, output: 10, cache_read: 1000, cache_write: 200, cache_write_1h: 200 }],
  ])("reads the counters of a %s record", (version, counters) => {
    expect(firstRecordOfVersion(version)).toMatchObject({
      tool: "claude-code",
      tool_version: version,
      ...counters,
    });
  });

  it("leaves no line of any observed version unrecognised", () => {
    const drift = journalLines().flatMap((line) => readClaudeUsageLine(line).unrecognised);
    expect(drift).toEqual([]);
  });
});
