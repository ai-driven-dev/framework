import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("releases exclusive access after a failed operation", async () => {
    await expect(
      store.withExclusiveAccess(root, async () => {
        throw new Error("operation refused");
      })
    ).rejects.toThrow("operation refused");
    expect(await store.withExclusiveAccess(root, async () => 42)).toBe(42);
    await expect(readFile(join(root, ".aidd/agents.json.lock"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("waits for a competing writer before reading ownership", async () => {
    const other = new AgentInstallationStoreAdapter(new FileAdapter(new HasherAdapter()));
    const first = { codex: { "aidd-dev-explorer": new FileHash("a".repeat(32)) } };
    const second = { "aidd-dev-reviewer": new FileHash("b".repeat(32)) };
    await Promise.all([
      store.withExclusiveAccess(root, async () =>
        store.save(root, { ...(await store.load(root)), ...first })
      ),
      other.withExclusiveAccess(root, async () =>
        other.save(root, { ...(await other.load(root)), opencode: second })
      ),
    ]);
    expect(await store.load(root)).toEqual({ ...first, opencode: second });
  });

  it("leaves a held lock intact and reports how to recover after timeout", async () => {
    const lock = join(root, ".aidd/agents.json.lock");
    await mkdir(lock, { recursive: true });
    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(30_001);
    const action = vi.fn();
    await expect(store.withExclusiveAccess(root, action)).rejects.toThrow(
      "remove this lock only if that operation has stopped"
    );
    expect(action).not.toHaveBeenCalled();
    await expect(mkdir(lock)).rejects.toMatchObject({ code: "EEXIST" });
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
