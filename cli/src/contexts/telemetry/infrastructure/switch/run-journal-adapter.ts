import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { modifiedAtIfPresent, readTextIfPresent } from "../../../../kernel/reading/text-file.js";
import { RUNS_DIR, RUNS_ENTRY, withoutRunsEntry } from "../../domain/legacy/run-journal.js";
import type {
  JournalCleanup,
  RunJournalCleaner,
} from "../../domain/ports/switch/run-journal-cleaner.js";
import { runGit } from "../run-git.js";

export class RunJournalAdapter implements RunJournalCleaner {
  /** `env` carries none of git's own variables, which would point it at another repository. */
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async clean(root: string): Promise<JournalCleanup> {
    // A journal somebody committed is theirs now: it is left, and said.
    const tracked = runGit(this.env, root, ["ls-files", "--", RUNS_ENTRY]).stdout.trim() !== "";
    const journal = join(root, ...RUNS_DIR.split("/"));
    const journalRemoved = !tracked && (await this.removeJournal(journal));
    return { journalRemoved, trackedKept: tracked, ignoreEntryRemoved: await this.unignore(root) };
  }

  private async removeJournal(path: string): Promise<boolean> {
    if ((await modifiedAtIfPresent(path)) === null) return false;
    await rm(path, { recursive: true, force: true });
    return true;
  }

  private async unignore(root: string): Promise<boolean> {
    const path = join(root, ".gitignore");
    const text = await readTextIfPresent(path);
    if (text === null) return false;
    const rewrite = withoutRunsEntry(text);
    if (rewrite.kind === "untouched") return false;
    if (rewrite.kind === "emptied") await rm(path);
    else await writeFile(path, rewrite.text, "utf8");
    return true;
  }
}
