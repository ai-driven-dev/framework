import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserScopeLockAdapter } from "../../../../src/contexts/machine-claims/infrastructure/lock.js";

describe("holding the machine lock on disk", () => {
  let dir: string;
  let lockPath: string;
  let lock: UserScopeLockAdapter;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "aidd-machine-lock-"));
    lockPath = join(dir, "manifest.json.lock");
    lock = new UserScopeLockAdapter(() => lockPath);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("fails closed at the bounded deadline without stealing another process's lock", async () => {
    await mkdir(lockPath);
    const now = vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(30_000);
    await expect(lock.withExclusiveAccess(async () => {})).rejects.toThrow(
      /User manifest is busy.*\.lock/
    );
    now.mockRestore();
    expect(existsSync(lockPath)).toBe(true);
  });

  it("serializes two holders so the second reads what the first wrote after the lock releases", async () => {
    const second = new UserScopeLockAdapter(() => lockPath);
    const state = join(dir, "state.txt");
    await writeFile(state, "");
    const append = async (line: string) =>
      writeFile(state, `${await readFile(state, "utf-8")}${line}\n`);
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let ready = () => {};
    const firstReady = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const firstMutation = lock.withExclusiveAccess(async () => {
      await append("first");
      ready();
      await held;
    });
    let secondEntered = false;
    let secondMutation: Promise<void> | undefined;
    try {
      await Promise.race([firstReady, firstMutation]);
      expect(existsSync(lockPath)).toBe(true);
      secondMutation = second.withExclusiveAccess(async () => {
        secondEntered = true;
        await append("second");
      });
      await pause(150);
      expect(secondEntered).toBe(false);
    } finally {
      release();
      await Promise.all([firstMutation, secondMutation]);
    }
    expect(await readFile(state, "utf-8")).toBe("first\nsecond\n");
    expect(existsSync(lockPath)).toBe(false);
  });
});
