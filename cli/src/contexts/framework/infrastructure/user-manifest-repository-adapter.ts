import { execFile as execFileCallback } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  link,
  mkdir,
  open,
  readFile,
  readlink,
  rm,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { hostname } from "node:os";
import { dirname } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { promisify } from "node:util";
import { userManifestPath } from "../../../kernel/paths.js";
import type { Manifest } from "../domain/manifest.js";
import type { ManifestRepository } from "../domain/ports/manifest-repository.js";
import { readManifestFile } from "./manifest-file-io.js";

const execFile = promisify(execFileCallback);

/**
 * The user-scope counterpart of `ManifestRepositoryAdapter` — same schema, same version and refusal
 * rule, same file I/O. Only the path differs, and what a version-refusal message names to fix it.
 *
 * `delete()` removes only `manifest.json` itself, never its parent directory: `userConfigDir()`
 * also holds `auth.json`, `marketplaces.json`, and `references.json`, none of which
 * this repository owns. Pruning it once empty, as the project adapter does with `.aidd/`, would be
 * a live bug here.
 */
export class UserManifestRepositoryAdapter implements ManifestRepository {
  constructor(
    private readonly userConfigDir: () => string,
    private readonly atomicWriter: (path: string, content: string) => Promise<void>,
    private readonly beforeAction?: () => Promise<void>
  ) {}

  get path(): string {
    return userManifestPath(this.userConfigDir());
  }

  async load(): Promise<Manifest | null> {
    return readManifestFile({
      path: this.path,
      location: "for this machine",
      reinstallCommand: "aidd setup --global",
    });
  }

  async save(manifest: Manifest): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await this.atomicWriter(this.path, JSON.stringify(manifest.toJSON(), null, 2));
  }

  async delete(): Promise<void> {
    await rm(this.path, { force: true });
  }

  async withExclusiveAccess<T>(action: () => Promise<T>): Promise<T> {
    const lock = `${this.path}.lock`;
    await mkdir(dirname(lock), { recursive: true });
    const deadline = Date.now() + 30_000;
    const realm = await localProcessRealm();
    // The link is atomic and already contains its owner at the instant it becomes visible.
    // A directory lock left by an older CLI remains unrecognized and is never removed here.
    const claim = `${lock}.${process.pid}-${randomBytes(12).toString("hex")}`;
    await writeFile(claim, JSON.stringify({ pid: process.pid, host: hostname(), realm }), {
      mode: 0o600,
      flag: "wx",
    });
    try {
      while (true) {
        const acquired = await withLockGuard(lock, deadline, async () => {
          try {
            await link(claim, lock);
            return true;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
            await removeDeadOwner(lock, realm);
            return false;
          }
        });
        if (acquired) break;
        await waitForLock(lock, deadline);
      }
      try {
        await this.beforeAction?.();
        return await action();
      } finally {
        // Hold the same short guard as recovery: ownership cannot change between a reaper's
        // liveness check and unlink. If this guard cannot be acquired, leave the lock intact.
        await withLockGuard(lock, Date.now() + 30_000, () => unlink(lock));
      }
    } finally {
      await unlink(claim);
    }
  }
}

async function waitForLock(lock: string, deadline: number): Promise<void> {
  if (Date.now() >= deadline)
    throw new Error(
      `User manifest is busy: ${lock}. Wait for other AIDD operations to finish. If none are running, inspect and remove this stale lock path, then retry; never remove a lock held by an active process.`
    );
  await pause(100);
}

/** Serialize lock acquisition, recovery and release so a stale observation cannot remove a new owner. */
async function withLockGuard<T>(
  lock: string,
  deadline: number,
  action: () => Promise<T>
): Promise<T> {
  const guard = `${lock}.guard`;
  while (true) {
    try {
      await mkdir(guard);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await waitForLock(guard, deadline);
    }
  }
  try {
    return await action();
  } finally {
    await rmdir(guard);
  }
}

/** Unknown, foreign-host, legacy and live locks stay untouched. PID reuse only delays recovery. */
async function removeDeadOwner(lock: string, realm: string | undefined): Promise<void> {
  if (realm === undefined) return;
  let owner: unknown;
  try {
    // Check and read one file; a substituted symlink is never followed and a FIFO never blocks.
    const file = await open(lock, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 1024) return;
      owner = JSON.parse(await file.readFile("utf8"));
    } finally {
      await file.close();
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ELOOP" || error instanceof SyntaxError) return;
    throw error;
  }
  if (
    owner === null ||
    typeof owner !== "object" ||
    !("pid" in owner) ||
    !("host" in owner) ||
    !("realm" in owner)
  )
    return;
  const pid = owner.pid;
  if (
    typeof pid !== "number" ||
    !Number.isSafeInteger(pid) ||
    pid <= 0 ||
    owner.host !== hostname() ||
    owner.realm !== realm
  )
    return;
  try {
    process.kill(pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") await unlink(lock);
  }
}

/** A PID means the same thing only in the same boot and PID namespace. Unknown realms fail closed. */
async function localProcessRealm(): Promise<string | undefined> {
  try {
    if (process.platform === "linux") {
      const boot = (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim();
      const namespace = await readlink("/proc/self/ns/pid");
      if (/^[0-9a-f-]{36}$/.test(boot) && /^pid:\[\d+\]$/.test(namespace))
        return `linux:${boot}:${namespace}`;
    }
    if (process.platform === "darwin") {
      const { stdout } = await execFile("/usr/sbin/sysctl", ["-n", "kern.bootsessionuuid"], {
        timeout: 1000,
        maxBuffer: 256,
      });
      const boot = stdout.trim();
      if (/^[0-9a-f-]{36}$/i.test(boot)) return `darwin:${boot}`;
    }
  } catch {
    // Recovery is optional: acquisition still works, but an unverifiable owner is never reaped.
    return undefined;
  }
  return undefined;
}
