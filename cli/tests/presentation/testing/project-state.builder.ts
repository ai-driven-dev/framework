import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { environmentWithoutGitVariables } from "../../../src/contexts/telemetry/domain/git-environment.js";

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
  const found = await Promise.all(
    (await entriesOf(dir)).map(async (entry) =>
      entry.isDirectory()
        ? (await listFilesUnder(join(dir, entry.name))).map((nested) => join(entry.name, nested))
        : [entry.name]
    )
  );
  return found.flat();
}

async function entriesOf(dir: string): Promise<Array<{ name: string; isDirectory(): boolean }>> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
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
  const parsed = JSON.parse(await readFile(path, "utf-8")) as T;
  return parsed;
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
