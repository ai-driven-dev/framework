import { realpath } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { isErrnoException } from "../../../kernel/reading/json-file.js";
import type { LocatedDirectory, RepositoryLocator } from "../domain/ports/repository-locator.js";
import { runGit } from "./run-git.js";

// `native` so Windows hands back the long, correctly cased name, not an 8.3 one.
const realPath = promisify(realpath.native);
const GONE = new Set(["ENOENT", "ENOTDIR"]);

/** Tells what a working directory is by asking git, from the directory's real path. */
export class GitRepositoryLocatorAdapter implements RepositoryLocator {
  /** `env` carries none of git's own variables, which would point it at another repository. */
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async locate(cwd: string): Promise<LocatedDirectory> {
    let real: string;
    try {
      real = await realPath(cwd);
    } catch (error) {
      if (isErrnoException(error) && GONE.has(error.code ?? "")) return { status: "gone" };
      throw error;
    }
    const top = runGit(this.env, real, ["rev-parse", "--show-toplevel", "--git-common-dir"]);
    const [toplevel, commonDir] = top.stdout.split("\n");
    if (top.status !== 0 || !toplevel || !commonDir) return { status: "outside-repository" };
    const root = resolve(toplevel);
    // `--git-common-dir` is relative to the directory git ran in.
    const common = resolve(real, commonDir);
    return {
      status: "repository",
      root,
      mainRoot: basename(common) === ".git" ? dirname(common) : root,
      clone: await realPath(common),
      remote: this.remote(real),
      rootCommit: this.rootCommit(real),
    };
  }

  private remote(cwd: string): string | null {
    const run = runGit(this.env, cwd, ["remote", "get-url", "origin"]);
    return run.status === 0 ? run.stdout.trim() : null;
  }

  /** A history can have several roots; the lowest sha is the same one on every machine. */
  private rootCommit(cwd: string): string | null {
    // Before the first commit git answers with a failure and nothing on stdout.
    const run = runGit(this.env, cwd, ["rev-list", "--max-parents=0", "HEAD"]);
    return (
      run.stdout
        .split("\n")
        .filter((sha) => sha !== "")
        .sort()[0] ?? null
    );
  }
}
