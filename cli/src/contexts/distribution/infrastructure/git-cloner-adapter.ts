import { simpleGit } from "simple-git";
import { PluginFetchError } from "../domain/distribution.error.js";
import { withoutCredentials } from "./inject-token.js";

const AUTH_ERROR_PATTERN =
  /Authentication failed|403|could not read Username|Permission denied \(publickey\)|Repository not found/i;

/** A clone to make: the URL it runs with, the URL an error may show, and where it lands. */
export interface CloneRequest {
  authUrl: string;
  displayUrl: string;
  targetDir: string;
  ref?: string;
}

/** Clones a git remote without ever prompting, and says a failure without the credential it ran with. */
export class GitCloner {
  private gitWithNoPrompt(baseDir?: string): ReturnType<typeof simpleGit> {
    const git = simpleGit({ baseDir, allowEnvironment: ["GIT_TERMINAL_PROMPT"] });
    return git.env("GIT_TERMINAL_PROMPT", "0");
  }

  async cloneShallow({ authUrl, displayUrl, targetDir, ref }: CloneRequest): Promise<void> {
    const args = ["--depth", "1", ...(ref ? ["--branch", ref] : [])];
    try {
      await this.gitWithNoPrompt().clone(authUrl, targetDir, args);
    } catch (err) {
      this.classifyAndThrow(err, displayUrl);
    }
  }

  async cloneSparse(
    { authUrl, displayUrl, targetDir, ref }: CloneRequest,
    subpath: string
  ): Promise<void> {
    try {
      await this.gitWithNoPrompt().clone(authUrl, targetDir, [
        "--filter=blob:none",
        "--no-checkout",
      ]);
      await this.gitWithNoPrompt(targetDir).raw(["sparse-checkout", "set", subpath]);
      await this.gitWithNoPrompt(targetDir).checkout(ref ?? "HEAD");
    } catch (err) {
      this.classifyAndThrow(err, displayUrl);
    }
  }

  private classifyAndThrow(err: unknown, displayUrl: string): never {
    const msg = err instanceof Error ? err.message : String(err);
    // The URL the user typed may carry their own credential; the message must not.
    const safeUrl = withoutCredentials(displayUrl);
    if (AUTH_ERROR_PATTERN.test(msg)) {
      throw new PluginFetchError(
        `Authentication failed for "${safeUrl}". ${this.authHint(safeUrl)}`
      );
    }
    throw new PluginFetchError(`git clone failed for "${safeUrl}": ${scrubCredentials(msg)}`);
  }

  private authHint(url: string): string {
    if (url.startsWith("git@")) {
      return "Check your SSH key is registered on the remote host.";
    }
    return "Set AIDD_TOKEN, run `aidd auth login`, or pass --token <value>. Required scope depends on the host (github: `repo`, gitlab: `read_repository`, bitbucket: `repository:read`).";
  }
}

function scrubCredentials(msg: string): string {
  return msg.replace(/https:\/\/[^@]+@/g, "https://");
}
