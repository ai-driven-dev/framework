import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { hostname, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { promisify } from "node:util";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Manifest } from "../../../../src/contexts/framework/domain/manifest.js";
import { UserManifestRepositoryAdapter } from "../../../../src/contexts/framework/infrastructure/user-manifest-repository-adapter.js";
import { atomicWriteFile } from "../../../../src/runtime/filesystem/atomic-write.js";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
let runnerDir: string;
let runner: string;

beforeAll(async () => {
  runnerDir = await mkdtemp(join(tmpdir(), "aidd-lock-runner-"));
  await writeFile(join(runnerDir, "package.json"), '{"type":"module"}');
  const entry = join(runnerDir, "runner.ts");
  const adapterPath = resolve(
    "src/contexts/framework/infrastructure/user-manifest-repository-adapter.ts"
  ).replaceAll("\\", "/");
  await writeFile(
    entry,
    `
import { open, unlink } from "node:fs/promises";
import { setTimeout as pause } from "node:timers/promises";
import { UserManifestRepositoryAdapter } from ${JSON.stringify(adapterPath)};
const [dir, mode] = process.argv.slice(2);
const repo = new UserManifestRepositoryAdapter(() => dir, async () => {});
await repo.withExclusiveAccess(async () => {
  if (mode === "hold") {
    process.stdout.write("locked\\n");
    await pause(60_000);
  } else {
    const gate = dir + "/in-critical-section";
    const file = await open(gate, "wx");
    process.stdout.write("locked\\n");
    await pause(150);
    await file.close();
    await unlink(gate);
  }
});
`
  );
  const tsup = join(dirname(require.resolve("tsup")), "cli-default.js");
  // Keep tsup's entry and cwd on the same volume: Windows temp and checkout may use
  // different drives, and tsup otherwise turns the absolute entry into a relative path.
  await execFileAsync(
    process.execPath,
    [tsup, "runner.ts", "--no-config", "--format", "esm", "--out-dir", ".", "--silent"],
    { cwd: runnerDir }
  );
  runner = join(runnerDir, "runner.mjs");
  await rename(join(runnerDir, "runner.js"), runner);
}, 30_000);

afterAll(async () => {
  await rm(runnerDir, { recursive: true, force: true });
});

function runLock(dir: string, mode: "hold" | "once") {
  const child = spawn(process.execPath, [runner, dir, mode], { stdio: ["ignore", "pipe", "pipe"] });
  const locked = new Promise<void>((resolvePromise, reject) => {
    child.stdout.once("data", () => resolvePromise());
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`lock runner exited before entry: ${code}`)));
  });
  return { child, locked };
}

async function currentRealm(): Promise<string | undefined> {
  if (process.platform === "linux") {
    const boot = (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim();
    return `linux:${boot}:${await readlink("/proc/self/ns/pid")}`;
  }
  if (process.platform === "darwin") {
    const { stdout } = await execFileAsync("/usr/sbin/sysctl", ["-n", "kern.bootsessionuuid"]);
    return `darwin:${stdout.trim()}`;
  }
  return undefined;
}

async function stoppedPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
  await once(child, "spawn");
  if (child.pid === undefined) throw new Error("child has no PID");
  const pid = child.pid;
  const exit = once(child, "exit");
  child.kill("SIGKILL");
  await exit;
  return pid;
}

async function expectBusy(action: () => Promise<unknown>): Promise<void> {
  const now = vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(30_000);
  try {
    await expect(action()).rejects.toThrow(/User manifest is busy/);
  } finally {
    now.mockRestore();
  }
}

describe("UserManifestRepositoryAdapter", () => {
  let userConfigDir: string;
  let adapter: UserManifestRepositoryAdapter;

  beforeEach(async () => {
    userConfigDir = await mkdtemp(join(tmpdir(), "aidd-user-manifest-repo-"));
    adapter = new UserManifestRepositoryAdapter(() => userConfigDir, atomicWriteFile);
  });

  afterEach(async () => {
    await rm(userConfigDir, { recursive: true, force: true });
  });

  it("names manifest.json directly under the user config dir, no .aidd nesting", () => {
    expect(adapter.path).toBe(join(userConfigDir, "manifest.json"));
  });

  describe("load()", () => {
    it("returns null when manifest.json does not exist", async () => {
      expect(await adapter.load()).toBeNull();
    });

    it("rejects with an instructive error naming the file when manifest.json is truncated", async () => {
      const manifestPath = join(userConfigDir, "manifest.json");
      await writeFile(manifestPath, '{"version": 8, "tools": {');

      await expect(adapter.load()).rejects.toThrow(manifestPath);
    });

    it('rejects a refused manifest version naming the real user manifest path and `aidd setup --global`, never .aidd/manifest.json or "in this project"', async () => {
      const manifestPath = join(userConfigDir, "manifest.json");
      await writeFile(manifestPath, '{"version": 7, "tools": {}}');

      await expect(adapter.load()).rejects.toThrow(
        new RegExp(`${manifestPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*aidd setup --global`)
      );
      await expect(adapter.load()).rejects.not.toThrow(/\.aidd\/manifest\.json/);
      await expect(adapter.load()).rejects.not.toThrow(/in this project/);
    });

    it("names this machine as where the refused manifest lives", async () => {
      const manifestPath = join(userConfigDir, "manifest.json");
      await writeFile(manifestPath, '{"version": 7, "tools": {}}');

      await expect(adapter.load()).rejects.toThrow(
        `delete ${manifestPath} for this machine, then run \`aidd setup --global\` to reinstall the framework.`
      );
    });
  });

  describe("save() + load() roundtrip", () => {
    it("persists and restores the manifest without data loss", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      const loaded = await adapter.load();
      expect(loaded?.getInstalledToolIds()).toHaveLength(0);
    });

    it("manifest version is 8 after roundtrip — same schema, same version as the project manifest", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      const loaded = await adapter.load();
      expect(loaded?.toJSON().version).toBe(8);
    });
  });

  describe("exclusive machine mutations", () => {
    it("publishes its actual owner and removes temporary claims when it releases", async () => {
      const lock = `${adapter.path}.lock`;
      const result = await adapter.withExclusiveAccess(async () => {
        const owner = JSON.parse(await readFile(lock, "utf8"));
        expect(owner).toMatchObject({ pid: process.pid, host: hostname() });
        const realm = await currentRealm();
        if (realm !== undefined) expect(owner.realm).toBe(realm);
        if (process.platform !== "win32") expect((await lstat(lock)).mode & 0o077).toBe(0);
        return "done";
      });
      expect(result).toBe("done");
      expect(
        (await readdir(userConfigDir)).filter((name) => name.startsWith("manifest.json.lock"))
      ).toEqual([]);
    });

    it.skipIf(process.platform === "win32")(
      "recovers a real dead owner in-process, then acquires its own lock",
      async () => {
        const realm = await currentRealm();
        expect(realm).toBeDefined();
        const pid = await stoppedPid();
        const lock = `${adapter.path}.lock`;
        await writeFile(lock, JSON.stringify({ pid, host: hostname(), realm }));
        let entered = false;
        // Allow one retry after the stale lock is removed; fail promptly if recovery is broken.
        const now = vi
          .spyOn(Date, "now")
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(1)
          .mockReturnValue(30_000);
        try {
          await adapter.withExclusiveAccess(async () => {
            entered = true;
            const owner = JSON.parse(await readFile(lock, "utf8"));
            expect(owner).toMatchObject({ pid: process.pid, host: hostname(), realm });
          });
        } finally {
          now.mockRestore();
        }
        expect(entered).toBe(true);
        expect(existsSync(lock)).toBe(false);
      }
    );

    it.skipIf(process.platform === "win32")(
      "never reaps an active PID or one whose existence cannot be checked",
      async () => {
        const realm = await currentRealm();
        const lock = `${adapter.path}.lock`;
        const record = JSON.stringify({ pid: process.pid, host: hostname(), realm });
        await writeFile(lock, record);
        let entered = false;
        await expectBusy(() =>
          adapter.withExclusiveAccess(async () => {
            entered = true;
          })
        );
        expect(entered).toBe(false);
        expect(await readFile(lock, "utf8")).toBe(record);

        const kill = vi.spyOn(process, "kill").mockImplementation(() => {
          throw Object.assign(new Error("permission denied"), { code: "EPERM" });
        });
        try {
          await expectBusy(() =>
            adapter.withExclusiveAccess(async () => {
              entered = true;
            })
          );
        } finally {
          kill.mockRestore();
        }
        expect(entered).toBe(false);
        expect(await readFile(lock, "utf8")).toBe(record);
      }
    );

    it.skipIf(process.platform === "win32")(
      "preserves invalid, foreign and oversized owner records",
      async () => {
        const realm = await currentRealm();
        const pid = await stoppedPid();
        const good = { pid, host: hostname(), realm };
        const lock = `${adapter.path}.lock`;
        const invalid = [
          "null",
          "0",
          "[]",
          "{broken",
          JSON.stringify({}),
          JSON.stringify({ host: hostname(), realm }),
          JSON.stringify({ pid, realm }),
          JSON.stringify({ pid, host: hostname() }),
          JSON.stringify({ ...good, pid: "1" }),
          JSON.stringify({ ...good, pid: 0 }),
          JSON.stringify({ ...good, pid: -1 }),
          JSON.stringify({ ...good, pid: 1.5 }),
          JSON.stringify({ ...good, pid: Number.MAX_SAFE_INTEGER + 1 }),
          JSON.stringify({ ...good, host: "foreign-host" }),
          JSON.stringify({ ...good, realm: "foreign-realm" }),
          `${JSON.stringify(good)}${" ".repeat(1025)}`,
        ];
        for (const record of invalid) {
          await writeFile(lock, record);
          let entered = false;
          const kill = vi.spyOn(process, "kill");
          try {
            await expectBusy(() =>
              adapter.withExclusiveAccess(async () => {
                entered = true;
              })
            );
            expect(kill).not.toHaveBeenCalled();
          } finally {
            kill.mockRestore();
          }
          expect(entered).toBe(false);
          expect(await readFile(lock, "utf8")).toBe(record);
          await rm(lock);
        }
      }
    );

    it.skipIf(process.platform === "win32")(
      "never follows a symbolic link presented as a lock",
      async () => {
        const realm = await currentRealm();
        const pid = await stoppedPid();
        const lock = `${adapter.path}.lock`;
        const foreign = join(userConfigDir, "foreign.json");
        const contents = JSON.stringify({ pid, host: hostname(), realm });
        await writeFile(foreign, contents);
        await symlink(foreign, lock);
        await expectBusy(() => adapter.withExclusiveAccess(async () => {}));
        expect(await readlink(lock)).toBe(foreign);
        expect(await readFile(foreign, "utf8")).toBe(contents);
      }
    );

    it.skipIf(process.platform === "win32")(
      "preserves a FIFO lock without waiting for a writer",
      async () => {
        const lock = `${adapter.path}.lock`;
        await execFileAsync("mkfifo", [lock]);
        const action = vi.fn(async () => {});
        await expectBusy(() => adapter.withExclusiveAccess(action));
        expect(action).not.toHaveBeenCalled();
        expect((await lstat(lock)).isFIFO()).toBe(true);
      }
    );

    it("does not probe or remove a dead owner when the process realm is unavailable", async () => {
      const realm = await currentRealm();
      const pid = await stoppedPid();
      const lock = `${adapter.path}.lock`;
      const record = JSON.stringify({ pid, host: hostname(), realm: realm ?? "unverifiable" });
      await writeFile(lock, record);
      const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
      if (descriptor === undefined) throw new Error("process.platform descriptor is missing");
      const kill = vi.spyOn(process, "kill");
      try {
        Object.defineProperty(process, "platform", { ...descriptor, value: "win32" });
        await expectBusy(() => adapter.withExclusiveAccess(async () => {}));
        expect(kill).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(process, "platform", descriptor);
        kill.mockRestore();
      }
      expect(await readFile(lock, "utf8")).toBe(record);
    });

    it.skipIf(process.platform === "win32" || (process.getuid?.() ?? 0) === 0)(
      "propagates a real filesystem permission failure without creating a claim",
      async () => {
        await chmod(userConfigDir, 0o500);
        try {
          await expect(adapter.withExclusiveAccess(async () => {})).rejects.toMatchObject({
            code: "EACCES",
          });
        } finally {
          await chmod(userConfigDir, 0o700);
        }
        expect(await readdir(userConfigDir)).toEqual([]);
      }
    );
    it("runs recovery while locked before the requested mutation", async () => {
      const events: string[] = [];
      const recovering = new UserManifestRepositoryAdapter(
        () => userConfigDir,
        atomicWriteFile,
        async () => {
          events.push("recovery");
        }
      );
      await recovering.withExclusiveAccess(async () => {
        events.push("action");
      });
      expect(events).toEqual(["recovery", "action"]);
      const failing = new UserManifestRepositoryAdapter(
        () => userConfigDir,
        atomicWriteFile,
        async () => {
          throw new Error("recovery failed");
        }
      );
      await expect(
        failing.withExclusiveAccess(async () => {
          events.push("unsafe");
        })
      ).rejects.toThrow("recovery failed");
      expect(events).toEqual(["recovery", "action"]);
      await expect(adapter.withExclusiveAccess(async () => {})).resolves.toBeUndefined();
    });

    it.skipIf(process.platform === "win32")(
      "reclaims a killed process's lock while serializing competing processes",
      async () => {
        const owner = runLock(userConfigDir, "hold");
        await owner.locked;
        const exit = once(owner.child, "exit");
        owner.child.kill("SIGKILL");
        await exit;
        const contenders = Array.from({ length: 4 }, () => runLock(userConfigDir, "once"));
        const exits = contenders.map(({ child }) => once(child, "exit"));
        await Promise.all(contenders.map(({ locked }) => locked));
        expect((await Promise.all(exits)).map(([code]) => code)).toEqual([0, 0, 0, 0]);
        expect(existsSync(`${adapter.path}.lock`)).toBe(false);
      },
      30_000
    );

    it.skipIf(process.platform === "win32")(
      "does not recover a live process's lock",
      async () => {
        const owner = runLock(userConfigDir, "hold");
        await owner.locked;
        const contender = runLock(userConfigDir, "once");
        let entered = false;
        void contender.locked.then(() => {
          entered = true;
        });
        try {
          await pause(350);
          expect(entered).toBe(false);
        } finally {
          const ownerExit = once(owner.child, "exit");
          owner.child.kill("SIGKILL");
          await ownerExit;
        }
        const contenderExit = once(contender.child, "exit");
        await contender.locked;
        expect((await contenderExit)[0]).toBe(0);
      },
      30_000
    );

    it.skipIf(process.platform !== "win32")(
      "refuses to reap when the PID realm cannot be verified",
      async () => {
        const owner = runLock(userConfigDir, "hold");
        await owner.locked;
        const exit = once(owner.child, "exit");
        owner.child.kill("SIGKILL");
        await exit;
        const now = vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(30_000);
        try {
          await expect(adapter.withExclusiveAccess(async () => {})).rejects.toThrow(
            /User manifest is busy/
          );
        } finally {
          now.mockRestore();
        }
        expect(existsSync(`${adapter.path}.lock`)).toBe(true);
      },
      30_000
    );

    it("keeps malformed or foreign owner records and a blocked recovery guard", async () => {
      const lock = `${adapter.path}.lock`;
      for (const content of [
        "{broken",
        JSON.stringify({ pid: 99999999, host: "foreign-host" }),
        JSON.stringify({ pid: 99999999, host: hostname(), realm: "another-pid-namespace" }),
      ]) {
        await writeFile(lock, content);
        const now = vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(30_000);
        try {
          await expect(adapter.withExclusiveAccess(async () => {})).rejects.toThrow(
            /User manifest is busy/
          );
        } finally {
          now.mockRestore();
        }
        expect(existsSync(lock)).toBe(true);
        await rm(lock);
      }
      await mkdir(`${lock}.guard`);
      const now = vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(30_000);
      try {
        await expect(adapter.withExclusiveAccess(async () => {})).rejects.toThrow(
          /User manifest is busy.*If none are running, inspect and remove this stale lock path.*never remove a lock held by an active process/
        );
      } finally {
        now.mockRestore();
      }
      expect(existsSync(`${lock}.guard`)).toBe(true);
    });
    it("fails closed at the bounded deadline without stealing another process's lock", async () => {
      const lock = `${adapter.path}.lock`;
      await mkdir(lock);
      const now = vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(30_000);
      await expect(adapter.withExclusiveAccess(async () => {})).rejects.toThrow(
        /User manifest is busy.*\.lock/
      );
      now.mockRestore();
      expect(existsSync(lock)).toBe(true);
    });

    it("serializes two claims so the second reads the first after the lock releases", async () => {
      const second = new UserManifestRepositoryAdapter(() => userConfigDir, atomicWriteFile);
      let release = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let ready = () => {};
      const firstReady = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const firstMutation = adapter.withExclusiveAccess(async () => {
        const manifest = (await adapter.load()) ?? Manifest.create();
        manifest.addTool("cursor", "1.0.0", []);
        await adapter.save(manifest);
        ready();
        await held;
      });
      let secondEntered = false;
      let secondMutation: Promise<void> | undefined;
      try {
        await Promise.race([firstReady, firstMutation]);
        expect(existsSync(`${adapter.path}.lock`)).toBe(true);
        secondMutation = second.withExclusiveAccess(async () => {
          secondEntered = true;
          const manifest = (await second.load()) ?? Manifest.create();
          manifest.addTool("codex", "1.0.0", []);
          await second.save(manifest);
        });
        await pause(150);
        expect(secondEntered).toBe(false);
      } finally {
        release();
        await Promise.all([firstMutation, secondMutation]);
      }
      expect((await adapter.load())?.getInstalledToolIds()).toEqual(["cursor", "codex"]);
      expect(existsSync(`${adapter.path}.lock`)).toBe(false);
    });

    it("keeps the old JSON and releases the lock when the atomic writer fails", async () => {
      const baseline = Manifest.create();
      baseline.addTool("cursor", "1.0.0", []);
      await adapter.save(baseline);
      const failing = new UserManifestRepositoryAdapter(
        () => userConfigDir,
        async () => {
          throw new Error("write failed before rename");
        }
      );
      const replacement = Manifest.create();
      replacement.addTool("codex", "1.0.0", []);
      await expect(failing.withExclusiveAccess(() => failing.save(replacement))).rejects.toThrow(
        "write failed before rename"
      );
      expect((await adapter.load())?.getInstalledToolIds()).toEqual(["cursor"]);
      expect(existsSync(`${adapter.path}.lock`)).toBe(false);
      await expect(adapter.withExclusiveAccess(async () => {})).resolves.toBeUndefined();
    });
  });

  describe("delete()", () => {
    it("deletes manifest.json from disk", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);

      await adapter.delete();

      expect(await adapter.load()).toBeNull();
    });

    it("never removes the user config dir itself — auth.json, marketplaces.json and references.json live there too", async () => {
      const manifest = Manifest.create();
      await adapter.save(manifest);
      // A neighbour this adapter must never touch, standing in for everything else living
      // directly under userConfigDir.
      const neighbour = join(userConfigDir, "marketplaces.json");
      await writeFile(neighbour, "{}");

      await adapter.delete();

      expect(existsSync(userConfigDir)).toBe(true);
      expect(existsSync(neighbour)).toBe(true);
    });

    it("silently succeeds when there is no manifest to delete", async () => {
      await expect(adapter.delete()).resolves.toBeUndefined();
    });
  });

  describe("manifest persistence", () => {
    it("creates the user config dir if it does not exist yet", async () => {
      const freshDir = join(userConfigDir, "not-yet-created");
      const freshAdapter = new UserManifestRepositoryAdapter(() => freshDir, atomicWriteFile);

      await freshAdapter.save(Manifest.create());

      expect(existsSync(join(freshDir, "manifest.json"))).toBe(true);
    });
  });
});
