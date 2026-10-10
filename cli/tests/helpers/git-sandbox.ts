import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { environmentWithoutGitVariables } from "../../src/runtime/git/git-environment.js";

/** git told to read no configuration of the machine running the test: a global `insteadOf`,
 * a signing key or a default branch name must not change what a test sees. */
export function sandboxGitEnv(home: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...environmentWithoutGitVariables(),
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    ...extra,
  };
}

export function git(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
    { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
}

/** A repository on `main` with one empty commit, and `origin` when given. */
export function initRepository(
  dir: string,
  env: NodeJS.ProcessEnv,
  options: { readonly remote?: string; readonly commit?: boolean } = {}
): void {
  mkdirSync(dir, { recursive: true });
  git(dir, env, "init", "-q", "-b", "main");
  if (options.remote !== undefined) git(dir, env, "remote", "add", "origin", options.remote);
  if (options.commit !== false) git(dir, env, "commit", "-q", "--allow-empty", "-m", "first");
}
