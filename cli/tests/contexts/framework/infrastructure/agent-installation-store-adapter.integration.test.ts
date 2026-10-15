import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentInstallationStoreAdapter } from "../../../../src/contexts/framework/infrastructure/agent-installation-store-adapter.js";
import { FileHash } from "../../../../src/kernel/file.js";
import { FileAdapter } from "../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../src/runtime/filesystem/hasher-adapter.js";

describe("AgentInstallationStoreAdapter", () => {
  let root: string;
  let store: AgentInstallationStoreAdapter;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-agent-store-"));
    store = new AgentInstallationStoreAdapter(new FileAdapter(new HasherAdapter()));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("round trips typed hashes for several hosts and removes an empty ledger", async () => {
    expect(await store.load(root)).toEqual({});
    const expected = {
      codex: { "aidd-dev-explorer": new FileHash("a".repeat(32)) },
      opencode: { "aidd-dev-reviewer": new FileHash("b".repeat(32)) },
    };
    await store.save(root, expected);
    expect(await store.load(root)).toEqual(expected);
    await store.save(root, {});
    await expect(readFile(join(root, ".aidd/agents.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it.each([
    "null",
    "[]",
    '"text"',
    "{",
    '{"other":{}}',
    '{"codex":null}',
    '{"codex":[]}',
    '{"codex":{"aidd-dev-explorer":42}}',
    '{"codex":{"aidd-dev-explorer":"bad"}}',
  ])("rejects malformed ownership data %s", async (data) => {
    await mkdir(join(root, ".aidd"));
    await writeFile(join(root, ".aidd/agents.json"), data);
    await expect(store.load(root)).rejects.toThrow();
  });
});
