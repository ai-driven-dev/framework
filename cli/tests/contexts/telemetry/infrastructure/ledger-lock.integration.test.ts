import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LedgerLock } from "../../../../src/contexts/telemetry/infrastructure/ledger-lock.js";

let dir: string;
let path: string;
const sleepers: { kill: () => boolean }[] = [];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "aidd-ledger-lock-"));
  path = join(dir, ".lock");
});

afterEach(async () => {
  for (const sleeper of sleepers.splice(0)) sleeper.kill();
  await rm(dir, { recursive: true, force: true });
});

function livingProcess(): number {
  const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
  sleepers.push(child);
  return child.pid as number;
}

function deadProcess(): number {
  const finished = spawnSync(process.execPath, ["-e", ""]);
  return finished.pid;
}

async function holder(): Promise<{ pid: number; created_at: string }> {
  return JSON.parse(await readFile(path, "utf8"));
}

const quick = { waitMs: 150, pollMs: 10 };

/** A clock that only moves when the lock sleeps. */
function fakeTime(start = Date.parse("2026-10-09T10:00:00.000Z")) {
  let now = start;
  const sleeps: number[] = [];
  return {
    sleeps,
    advance: (ms: number) => {
      now += ms;
    },
    options: {
      now: () => now,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        now += ms;
      },
    },
  };
}

describe("the ledger lock", () => {
  it("is a file holding the pid and creation time of its owner", async () => {
    const release = await new LedgerLock(path).acquire();
    const held = await holder();
    expect(held.pid).toBe(process.pid);
    expect(Date.parse(held.created_at)).not.toBeNaN();
    await release();
  });

  it("is gone once released", async () => {
    const release = await new LedgerLock(path).acquire();
    await release();
    await expect(readFile(path)).rejects.toThrow();
  });

  it("is never released from under its new owner", async () => {
    const release = await new LedgerLock(path, { pid: 4242, isAlive: () => true }).acquire();
    await rm(path);
    await writeFile(path, JSON.stringify({ pid: 777, created_at: new Date().toISOString() }));
    await release();
    expect((await holder()).pid).toBe(777);
  });

  it("clears a lock whose owner is dead", async () => {
    await writeFile(
      path,
      JSON.stringify({ pid: deadProcess(), created_at: new Date().toISOString() })
    );
    const release = await new LedgerLock(path, quick).acquire();
    expect((await holder()).pid).toBe(process.pid);
    await release();
  });

  it("clears a lock older than the timeout, even when its pid answers", async () => {
    const old = new Date(Date.now() - 20 * 60_000).toISOString();
    await writeFile(path, JSON.stringify({ pid: livingProcess(), created_at: old }));
    const release = await new LedgerLock(path, { ...quick, staleAfterMs: 60_000 }).acquire();
    expect((await holder()).pid).toBe(process.pid);
    await release();
  });

  it("respects a lock whose owner is alive and recent", async () => {
    const owner = livingProcess();
    await writeFile(path, JSON.stringify({ pid: owner, created_at: new Date().toISOString() }));
    await expect(new LedgerLock(path, quick).acquire()).rejects.toThrow(/locked by process/);
    expect((await holder()).pid).toBe(owner);
  });

  it("waits for a held lock and takes it once released", async () => {
    const first = await new LedgerLock(path).acquire();
    const second = new LedgerLock(path, { waitMs: 5000, pollMs: 10 }).acquire();
    await new Promise((done) => setTimeout(done, 60));
    await first();
    const release = await second;
    expect((await holder()).pid).toBe(process.pid);
    await release();
  });

  it("does not take a lock whose content cannot be read while it is recent", async () => {
    await writeFile(path, "{not json");
    await expect(new LedgerLock(path, quick).acquire()).rejects.toThrow(/locked by process/);
    expect(await readFile(path, "utf8")).toBe("{not json");
  });

  it("clears a lock whose content cannot be read once its file is old", async () => {
    await writeFile(path, "");
    const old = new Date(Date.now() - 20 * 60_000);
    await utimes(path, old, old);
    const release = await new LedgerLock(path, { ...quick, staleAfterMs: 60_000 }).acquire();
    expect((await holder()).pid).toBe(process.pid);
    await release();
  });

  it("reads a lock with a pid but no time as unreadable, not as young", async () => {
    await writeFile(path, JSON.stringify({ pid: livingProcess() }));
    const old = new Date(Date.now() - 20 * 60_000);
    await utimes(path, old, old);
    const release = await new LedgerLock(path, { ...quick, staleAfterMs: 60_000 }).acquire();
    expect((await holder()).pid).toBe(process.pid);
    await release();
  });
});

describe("the ledger lock's waiting", () => {
  it("polls at its interval and gives up exactly when the wait is over", async () => {
    const time = fakeTime();
    const owner = { pid: 4242, created_at: new Date(time.options.now()).toISOString() };
    await writeFile(path, JSON.stringify(owner));
    const lock = new LedgerLock(path, {
      ...time.options,
      isAlive: () => true,
      waitMs: 100,
      pollMs: 50,
      staleAfterMs: 1_000_000,
    });
    await expect(lock.acquire()).rejects.toThrow(/locked by process 4242/);
    expect(time.sleeps).toEqual([50, 50]);
  });

  it("names where the lock is and what to do about it", async () => {
    const time = fakeTime();
    await writeFile(
      path,
      JSON.stringify({ pid: 4242, created_at: new Date(time.options.now()).toISOString() })
    );
    const lock = new LedgerLock(path, { ...time.options, isAlive: () => true, waitMs: 0 });
    await expect(lock.acquire()).rejects.toThrow(
      /The telemetry ledger is locked by process 4242, which is still running\. Wait for it to finish, or remove .*\.lock if that process is not an aidd command/
    );
  });

  it("says unknown for the owner of a lock it cannot read", async () => {
    const time = fakeTime();
    await writeFile(path, "{not json");
    await utimes(path, new Date(time.options.now()), new Date(time.options.now()));
    const lock = new LedgerLock(path, { ...time.options, waitMs: 0 });
    await expect(lock.acquire()).rejects.toThrow(/locked by process unknown/);
  });

  it("takes a lock only once it is older than the timeout, not at it", async () => {
    const time = fakeTime();
    await writeFile(
      path,
      JSON.stringify({ pid: 4242, created_at: new Date(time.options.now()).toISOString() })
    );
    const options = { ...time.options, isAlive: () => true, waitMs: 0, staleAfterMs: 1000 };
    time.advance(1000);
    await expect(new LedgerLock(path, options).acquire()).rejects.toThrow(/locked/);
    time.advance(1);
    const release = await new LedgerLock(path, options).acquire();
    expect((await holder()).pid).toBe(process.pid);
    await release();
  });

  it.each([
    ["a pid that is not a number", { pid: "4242", created_at: "2026-10-09T10:00:00.000Z" }],
    ["a pid that is not whole", { pid: 4242.5, created_at: "2026-10-09T10:00:00.000Z" }],
    ["a time that is not one", { pid: 4242, created_at: "yesterday" }],
    ["no time", { pid: 4242 }],
    ["no pid", { created_at: "2026-10-09T10:00:00.000Z" }],
  ])("judges a lock with %s by its file's age", async (_name, content) => {
    const time = fakeTime();
    await writeFile(path, JSON.stringify(content));
    const old = new Date(time.options.now() - 5000);
    await utimes(path, old, old);
    const lock = new LedgerLock(path, {
      ...time.options,
      isAlive: () => true,
      waitMs: 0,
      staleAfterMs: 1000,
    });
    const release = await lock.acquire();
    expect((await holder()).pid).toBe(process.pid);
    await release();
  });

  it("does not mistake a pid it cannot read for a dead one", async () => {
    const time = fakeTime();
    await writeFile(path, JSON.stringify({ pid: "4242", created_at: "2026-10-09T10:00:00.000Z" }));
    await utimes(path, new Date(time.options.now()), new Date(time.options.now()));
    const lock = new LedgerLock(path, { ...time.options, isAlive: () => false, waitMs: 0 });
    await expect(lock.acquire()).rejects.toThrow(/locked/);
  });

  it("fails, rather than waits, when the lock cannot be created at all", async () => {
    await expect(new LedgerLock(join(dir, "missing", ".lock"), quick).acquire()).rejects.toThrow(
      /ENOENT/
    );
  });

  it("releases quietly when the lock file is already gone", async () => {
    const release = await new LedgerLock(path).acquire();
    await rm(path);
    await expect(release()).resolves.toBeUndefined();
  });

  it.skipIf(process.platform === "win32")(
    "counts a process it may not signal as alive",
    async () => {
      await writeFile(path, JSON.stringify({ pid: 1, created_at: new Date().toISOString() }));
      await expect(new LedgerLock(path, quick).acquire()).rejects.toThrow(/locked by process 1/);
    }
  );

  it("writes a lock only its owner can read", async () => {
    const release = await new LedgerLock(path).acquire();
    if (process.platform !== "win32") expect((await stat(path)).mode & 0o777).toBe(0o600);
    await release();
  });
});
