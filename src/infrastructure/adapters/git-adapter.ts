import { join } from "node:path";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { VersionControl } from "../../domain/ports/version-control.js";

const GITDIR_PREFIX = "gitdir:";
const HOOK_HEADER = "#!/bin/sh";
const PRE_COMMIT_HOOK = "pre-commit";

export class GitAdapter implements VersionControl {
  constructor(private readonly fs: FileSystem) {}

  async installPreCommitDelegate(projectRoot: string, delegatePath: string): Promise<void> {
    const hooksDir = await this.resolveHooksDir(projectRoot);
    if (hooksDir === null) return;

    const marker = `sh ${delegatePath}`;
    const hookPath = join(hooksDir, PRE_COMMIT_HOOK);
    const exists = await this.fs.fileExists(hookPath);
    let content = exists ? await this.fs.readFile(hookPath) : `${HOOK_HEADER}\n`;

    if (content.includes(marker)) return;

    if (!content.endsWith("\n")) content += "\n";
    content += `${marker}\n`;

    await this.fs.writeFile(hookPath, content);
    await this.fs.chmodExecutable(hookPath);
  }

  private async resolveHooksDir(projectRoot: string): Promise<string | null> {
    const gitEntry = join(projectRoot, ".git");
    if (!(await this.fs.fileExists(gitEntry))) return null;

    let gitDir = gitEntry;
    try {
      const fileContent = await this.fs.readFile(gitEntry);
      const firstLine = fileContent.trim().split("\n")[0] ?? "";
      if (firstLine.startsWith(GITDIR_PREFIX)) {
        const worktreeGitDir = firstLine.slice(GITDIR_PREFIX.length).trim();
        // common git dir: .git/worktrees/<name> -> two levels up -> .git
        gitDir = join(worktreeGitDir, "..", "..");
      }
    } catch {
      // .git is a directory — gitDir stays as-is
    }

    return join(gitDir, "hooks");
  }
}
