import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { environmentWithoutGitVariables } from "../../src/contexts/telemetry/infrastructure/git/git-environment.js";

const execFileAsync = promisify(execFile);

/** `git status --porcelain` of a repository, empty when nothing differs from the last commit. */
export async function gitStatusPorcelain(cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
    cwd,
    env: environmentWithoutGitVariables(process.env),
  });
  return stdout;
}

/** Every file under `dir`, relative to it, recursively: `[]` for a directory that no longer
 * exists, the honest "nothing left" answer rather than a thrown ENOENT. */
export async function listFilesUnder(dir: string): Promise<string[]> {
  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const results: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const nested of await listFilesUnder(full)) results.push(join(entry.name, nested));
    } else {
      results.push(entry.name);
    }
  }
  return results;
}

/** Whether a directory is still there at all: `listFilesUnder` answers `[]` for an empty one
 * and a removed one alike, so proving a shell was removed needs its own question. */
export async function directoryExists(dir: string): Promise<boolean> {
  try {
    await readdir(dir);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function readJson<T = Record<string, unknown>>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf-8")) as T;
}

/** A project that has been initialised and has installed nothing yet. */
export async function seedEmptyManifest(projectDir: string): Promise<void> {
  await mkdir(join(projectDir, ".aidd"), { recursive: true });
  await writeFile(
    join(projectDir, ".aidd", "manifest.json"),
    JSON.stringify({ version: 8, tools: {} }),
    "utf-8"
  );
}
