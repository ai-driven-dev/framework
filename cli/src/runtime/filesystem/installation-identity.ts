import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, open, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isErrnoException, tryParseJson } from "../../kernel/reading/json-file.js";
import { asPlainObject } from "../../kernel/reading/plain-object.js";
import { PrivateStorageAdapter } from "./private-storage-adapter.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readInstallationId(path: string): Promise<string | null> {
  const handle = await open(
    path,
    process.platform === "win32"
      ? constants.O_RDONLY
      : constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  ).catch((error) => {
    if (isErrnoException(error) && error.code === "ENOENT") return null;
    throw error;
  });
  if (handle === null) return null;
  try {
    const info = await handle.stat();
    if (!info.isFile() || (process.platform !== "win32" && (info.mode & 0o077) !== 0)) {
      throw new Error("Installation identity must be a private regular file.");
    }
    const parsed = tryParseJson(await handle.readFile("utf8"));
    const object = parsed.ok ? asPlainObject(parsed.value) : null;
    const id = object?.installation_id;
    if (typeof id !== "string" || !UUID_V4.test(id)) {
      throw new Error("Installation identity is invalid; the existing file was left unchanged.");
    }
    return id;
  } finally {
    await handle.close();
  }
}

/** Validate a pre-existing ID without creating any files. */
export function checkInstallationId(userConfigDir: string): Promise<string | null> {
  return readInstallationId(join(userConfigDir, "installation", "id.json"));
}

/** The caller's operation has already taken effect when this is called. */
export async function finishInstallationId(
  ensure: () => Promise<string>,
  outcome: string
): Promise<void> {
  try {
    await ensure();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${outcome}, but the installation ID could not be saved: ${reason}. Retry.`);
  }
}

/** A machine-local installation identifier, not a person, credential or authentication token.
 * A completed temporary file is linked into place without replacing a concurrent initializer. */
export async function ensureInstallationId(userConfigDir: string): Promise<string> {
  const directory = join(userConfigDir, "installation");
  const path = join(directory, "id.json");
  await new PrivateStorageAdapter().ensureDirectory(directory);
  const existing = await readInstallationId(path);
  if (existing !== null) return existing;

  const id = randomUUID();
  const temporary = join(directory, `${id}.tmp`);
  let created = false;
  try {
    await writeFile(temporary, `${JSON.stringify({ installation_id: id })}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    created = true;
    try {
      await link(temporary, path);
      return id;
    } catch (error) {
      if (!isErrnoException(error) || error.code !== "EEXIST") throw error;
      const winner = await readInstallationId(path);
      if (winner === null) throw new Error("Installation identity disappeared during setup.");
      return winner;
    }
  } finally {
    if (created) await rm(temporary, { force: true });
  }
}
