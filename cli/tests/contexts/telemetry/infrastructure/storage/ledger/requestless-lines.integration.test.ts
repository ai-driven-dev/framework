import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { machinePrivateStorage } from "../../../../../shared/testing/machine-private-storage.builder.js";
import { ledgerOver } from "../../../testing/ledger-adapters.builder.js";

let dir: string;
const storage = machinePrivateStorage();

beforeEach(async () => {
  const root = await mkdtemp(join(tmpdir(), "aidd-ids-"));
  dir = join(root, "ledger");
  await mkdir(dir, { recursive: true });
});
afterEach(async () => {
  await rm(join(dir, ".."), { recursive: true, force: true });
});

const ID = "a-repository-id";

function call(overrides: Record<string, unknown> = {}) {
  return {
    tool: "claude-code",
    tool_version: "2",
    key: "msg_A:req_A",
    session_id: "s-1",
    agent: "main",
    at: "2026-10-07T23:59:59.000Z",
    model: "m",
    input: 1,
    output: 1,
    cache_read: 0,
    cache_write: 0,
    cache_write_1h: null,
    reasoning: null,
    cwd: "/work/a",
    git_branch: null,
    repository_id: ID,
    ...overrides,
  };
}

describe("the ledger, read with lines it does not accept", () => {
  it("reads a call with no request id, as any version keyed it, as a line it does not accept, and keeps it as found", async () => {
    const kept = call({ key: "msg_B:req_B", at: "2026-10-08T00:00:01.000Z" });
    const copies = [
      call({ key: "msg_A:s-1:2026-10-08T00:00:02.000Z", at: "2026-10-08T00:00:02.000Z" }),
      call({ key: "msg_A:s-1#advisor0", at: "2026-10-08T00:00:03.000Z" }),
    ];
    const text = `${[kept, ...copies].map((line) => JSON.stringify(line)).join("\n")}\n`;
    await writeFile(join(dir, "2026-10-08.jsonl"), text);
    const ledger = ledgerOver(dir, storage);
    const held = await ledger.load();
    expect(held.records).toEqual([kept]);
    expect(held.skippedLines).toBe(2);
    expect(held.damaged).toEqual(new Set(["2026-10-08"]));
    await ledger.save(held.records, new Set(["2026-10-08"]));
    expect(await readFile(join(dir, "2026-10-08.jsonl"), "utf8")).toBe(
      `${[JSON.stringify(kept), ...copies.map((line) => JSON.stringify(line)).sort()].join("\n")}\n`
    );
    expect(await ledger.leftOut.counts()).toEqual({ undated: 0, unrecognised: 0, requestless: 0 });
  });
});
