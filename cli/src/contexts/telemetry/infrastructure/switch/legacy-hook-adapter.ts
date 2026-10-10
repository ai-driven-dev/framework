import { rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readTextIfPresent } from "../../../../kernel/reading/text-file.js";
import {
  isInstalledDelegate,
  mentionsDelegate,
  TRAILER_DELEGATE_FILE,
  withoutTrailerCall,
} from "../../domain/legacy/legacy-hook.js";
import type {
  HookCleanup,
  LegacyHookCleaner,
} from "../../domain/ports/switch/legacy-hook-cleaner.js";
import { runGit } from "../run-git.js";

const HOOK = "prepare-commit-msg";
const LEFTHOOK_FILES = ["lefthook.yml", "lefthook.yaml", ".lefthook.yml", ".lefthook.yaml"];
/** Named as the repository names it, with `/` on every platform; `join` resolves it to a path. */
const HUSKY_HOOK = `.husky/${HOOK}`;

export class LegacyHookAdapter implements LegacyHookCleaner {
  /** `env` carries none of git's own variables, which would point it at another repository. */
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async clean(root: string): Promise<HookCleanup> {
    const hooksDirs = this.hooksDirs(root);
    const lineRemoved = await this.removeCall(join(hooksDirs.hooks, HOOK));
    // Read again after the rewrite: the script stays for as long as anything still names it.
    const callers = await this.callers(root, join(hooksDirs.hooks, HOOK));
    let delegateRemoved = false;
    let kept = false;
    for (const dir of new Set([hooksDirs.hooks, hooksDirs.common])) {
      const path = join(dir, TRAILER_DELEGATE_FILE);
      const text = await readTextIfPresent(path);
      if (text === null || !isInstalledDelegate(text)) continue;
      if (callers.length === 0) {
        await rm(path);
        delegateRemoved = true;
      } else {
        kept = true;
      }
    }
    return { lineRemoved, delegateRemoved, stillCalledBy: kept ? callers : [] };
  }

  /** Where git runs hooks from, and the fixed place a manager's job looks the script up. */
  private hooksDirs(root: string): { hooks: string; common: string } {
    const hooks = runGit(this.env, root, ["rev-parse", "--git-path", "hooks"]).stdout.trim();
    const common = runGit(this.env, root, ["rev-parse", "--git-common-dir"]).stdout.trim();
    return { hooks: resolve(root, hooks), common: join(resolve(root, common), "hooks") };
  }

  private async removeCall(path: string): Promise<boolean> {
    const text = await readTextIfPresent(path);
    if (text === null) return false;
    const rewrite = withoutTrailerCall(text);
    if (rewrite.kind === "untouched") return false;
    // Written in place, not by rename: the file keeps its mode, and git skips a hook that
    // lost its executable bit without saying so.
    if (rewrite.kind === "emptied") await rm(path);
    else await writeFile(path, rewrite.text, "utf8");
    return true;
  }

  /** Every file that still names the script. The managers' own files are only read. */
  private async callers(root: string, hook: string): Promise<string[]> {
    const files: [string, string][] = [
      [HOOK, hook],
      [HUSKY_HOOK, join(root, HUSKY_HOOK)],
      ...LEFTHOOK_FILES.map((name): [string, string] => [name, join(root, name)]),
    ];
    const named: string[] = [];
    for (const [label, path] of files) {
      const text = await readTextIfPresent(path);
      if (text !== null && mentionsDelegate(text)) named.push(label);
    }
    return named;
  }
}
