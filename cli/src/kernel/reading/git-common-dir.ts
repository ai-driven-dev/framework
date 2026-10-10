import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { repositoryRootAbove } from "./repository-root.js";

const GIT_DIR_NAME = ".git";
const GITDIR_POINTER = /^gitdir:\s*(.+?)\s*$/mu;

/** What `git rev-parse --git-common-dir` answers for `start`, absolute, read from files rather
 * than by spawning git; `null` outside any checkout. */
export function gitCommonDirAbove(start: string): string | null {
  const root = repositoryRootAbove(start);
  const dotGit = join(root, GIT_DIR_NAME);
  let isDirectory: boolean;
  try {
    isDirectory = statSync(dotGit).isDirectory();
  } catch {
    return null;
  }
  if (isDirectory) return dotGit;
  const gitDir = readGitDirPointer(root, dotGit);
  if (gitDir === null) return null;
  try {
    return resolve(gitDir, readFileSync(join(gitDir, "commondir"), "utf8").trim());
  } catch {
    return gitDir;
  }
}

function readGitDirPointer(root: string, dotGitFile: string): string | null {
  try {
    const match = GITDIR_POINTER.exec(readFileSync(dotGitFile, "utf8"));
    return match?.[1] ? resolve(root, match[1]) : null;
  } catch {
    return null;
  }
}

function linkedWorktreeRoot(worktreesDir: string, entry: string): string | null {
  try {
    const pointer = readFileSync(join(worktreesDir, entry, "gitdir"), "utf8").trim();
    const root = dirname(resolve(worktreesDir, entry, pointer));
    return existsSync(root) ? root : null;
  } catch {
    return null;
  }
}

/** The main working tree (non-bare clones only), then every linked worktree still on disk. */
export function worktreeRootsOf(commonDir: string): readonly string[] {
  const roots: string[] = [];
  if (basename(commonDir) === GIT_DIR_NAME) roots.push(dirname(commonDir));
  const worktreesDir = join(commonDir, "worktrees");
  let entries: string[];
  try {
    entries = readdirSync(worktreesDir);
  } catch {
    return roots;
  }
  for (const entry of entries.sort()) {
    const root = linkedWorktreeRoot(worktreesDir, entry);
    if (root !== null) roots.push(root);
  }
  return roots;
}
