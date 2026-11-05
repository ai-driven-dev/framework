import { execFile as execFileCb } from "node:child_process";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { simpleGit } from "simple-git";
import { PluginFetchError } from "../../../kernel/errors.js";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../kernel/ports/file-writer.js";
import {
  type PluginSource,
  type PluginSourceGitHub,
  type PluginSourceGitSubdir,
  type PluginSourceNpm,
  type PluginSourceUrl,
  SHA_REGEX,
} from "../../../kernel/source.js";
import type { TokenProvider } from "../../../runtime/auth/ports/token-provider.js";
import { injectTokenIntoUrl, withoutCredentials } from "../../../runtime/git/inject-token.js";
import type { PluginFetcher, PluginFetchOptions } from "../domain/ports/plugin-fetcher.js";

const execFile = promisify(execFileCb);

const AUTH_ERROR_PATTERN =
  /Authentication failed|403|could not read Username|Permission denied \(publickey\)|Repository not found/i;

export class PluginFetcherAdapter implements PluginFetcher {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly tokenProvider?: TokenProvider
  ) {}

  async fetch(
    source: PluginSource,
    cacheDir: string,
    options?: PluginFetchOptions
  ): Promise<string> {
    const forceRefresh = options?.forceRefresh ?? false;
    const canonicalCheckout = options?.canonicalCheckout ?? false;
    switch (source.kind) {
      case "local":
        return this.fetchLocal(source.path);
      case "github":
        return this.fetchGitHub(source, cacheDir, forceRefresh, canonicalCheckout);
      case "url":
        return this.fetchUrl(source, cacheDir, forceRefresh, canonicalCheckout);
      case "git-subdir":
        return this.fetchGitSubdir(source, cacheDir, forceRefresh, canonicalCheckout);
      case "npm":
        return this.fetchNpm(source, cacheDir, forceRefresh);
    }
  }

  private async fetchLocal(path: string): Promise<string> {
    const resolved = resolve(path);
    if (!(await this.fs.fileExists(resolved))) {
      throw new PluginFetchError(`local path does not exist: "${resolved}"`);
    }
    return resolved;
  }

  private async fetchGitHub(
    source: PluginSourceGitHub,
    cacheDir: string,
    forceRefresh: boolean,
    canonicalCheckout: boolean
  ): Promise<string> {
    const baseUrl = `https://github.com/${source.repo}.git`;
    const key = `github-${source.repo.replace("/", "-")}-${source.ref ?? "HEAD"}`;
    const targetDir = join(cacheDir, key);
    await this.prepareGitCache(targetDir, forceRefresh, source.sha);
    if (!(await this.fs.fileExists(targetDir))) {
      const token = (await this.tokenProvider?.resolve()) ?? undefined;
      await this.cloneShallow(
        injectTokenIntoUrl(baseUrl, token),
        baseUrl,
        targetDir,
        source.ref,
        canonicalCheckout || source.sha !== undefined
      );
    }
    await this.verifyPinnedCheckout(targetDir, source.sha);
    return targetDir;
  }

  private async fetchUrl(
    source: PluginSourceUrl,
    cacheDir: string,
    forceRefresh: boolean,
    canonicalCheckout: boolean
  ): Promise<string> {
    const key = `${encodeKey(withoutCredentials(source.url))}${source.ref ? `-${source.ref}` : "-HEAD"}`;
    const targetDir = join(cacheDir, key);
    await this.prepareGitCache(targetDir, forceRefresh, source.sha);
    if (!(await this.fs.fileExists(targetDir))) {
      const token = (await this.tokenProvider?.resolve()) ?? undefined;
      const authUrl = source.url.startsWith("git@")
        ? source.url
        : injectTokenIntoUrl(source.url, token);
      await this.cloneShallow(
        authUrl,
        source.url,
        targetDir,
        source.ref,
        canonicalCheckout || source.sha !== undefined
      );
    }
    await this.verifyPinnedCheckout(targetDir, source.sha);
    return targetDir;
  }

  private async fetchGitSubdir(
    source: PluginSourceGitSubdir,
    cacheDir: string,
    forceRefresh: boolean,
    canonicalCheckout: boolean
  ): Promise<string> {
    const { url, path: subpath, ref } = source;
    const key = `${encodeKey(withoutCredentials(url))}-subdir-${subpath.replace(/\//g, "_")}-${ref ?? "HEAD"}`;
    const targetDir = join(cacheDir, key);
    await this.prepareGitCache(targetDir, forceRefresh, source.sha, subpath);
    if (!(await this.fs.fileExists(targetDir))) {
      const token = (await this.tokenProvider?.resolve()) ?? undefined;
      const authUrl = url.startsWith("git@") ? url : injectTokenIntoUrl(url, token);
      await this.cloneSparse(
        authUrl,
        url,
        targetDir,
        subpath,
        ref,
        canonicalCheckout || source.sha !== undefined
      );
    }
    await this.verifyPinnedCheckout(targetDir, source.sha, subpath);
    return join(targetDir, subpath);
  }

  /** A pinned cache is usable only while both its commit and its working tree match the pin. */
  private async verifyPinnedCheckout(
    directory: string,
    sha: string | undefined,
    subpath?: string
  ): Promise<void> {
    if (sha === undefined) return;
    if (!SHA_REGEX.test(sha)) throw new PluginFetchError("invalid pinned Git SHA.");
    let commit: string;
    let changes: string;
    let index: string;
    try {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_CONFIG_NOSYSTEM: "1",
        // Git documents /dev/null for this variable, including Git for Windows; Node's
        // Windows devNull is \\.\nul, which Git for Windows cannot open as a config file.
        GIT_CONFIG_GLOBAL: "/dev/null",
      };
      for (const key of Object.keys(env)) {
        if (
          /^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_PARAMETERS|CONFIG_COUNT|CONFIG_KEY_\d+|CONFIG_VALUE_\d+|NAMESPACE|REPLACE_REF_BASE)$/.test(
            key
          )
        )
          delete env[key];
      }
      const run = (args: string[]) =>
        execFile(
          "git",
          [
            "-c",
            "core.fsmonitor=false",
            "-c",
            "core.untrackedCache=false",
            "-c",
            "core.trustctime=true",
            "-c",
            "core.checkstat=default",
            "-c",
            "core.autocrlf=false",
            "-c",
            "core.eol=lf",
            "--literal-pathspecs",
            ...args,
          ],
          { cwd: directory, env }
        );
      commit = (await run(["rev-parse", "--verify", "HEAD^{commit}"])).stdout.trim();
      changes = (
        await run([
          "status",
          "--porcelain=v1",
          "--untracked-files=all",
          "--ignored=matching",
          "--ignore-submodules=none",
          "--",
        ])
      ).stdout;
      index = (
        await run(["ls-files", "-v", "-z", "--", ...(subpath === undefined ? [] : [subpath])])
      ).stdout;
    } catch {
      // A Git error can contain credentials from remote configuration. The path itself may
      // also have been supplied by the user, so neither is needed in this diagnostic.
      throw new PluginFetchError("unable to verify the pinned Git checkout.");
    }
    if (commit !== sha)
      throw new PluginFetchError("the checked-out Git commit does not match the pinned SHA.");
    if (changes.trim())
      throw new PluginFetchError(
        "the pinned Git cache cannot be verified: it may contain modified, untracked or ignored files, or noncanonical line endings. Inspect the cache manually before retrying."
      );
    if (
      index
        .split("\0")
        .some((line) => line && (line[0] === "S" || line[0] === line[0]?.toLowerCase()))
    )
      throw new PluginFetchError("the pinned Git checkout hides tracked file changes.");
  }

  private async bustCacheIfNeeded(targetDir: string, forceRefresh: boolean): Promise<void> {
    if (forceRefresh && (await this.fs.fileExists(targetDir))) {
      await this.fs.deleteDirectory(targetDir);
    }
  }

  /** Do not discard edits made to a pinned checkout even on an explicit refresh. */
  private async prepareGitCache(
    targetDir: string,
    forceRefresh: boolean,
    sha: string | undefined,
    subpath?: string
  ): Promise<void> {
    if (sha !== undefined && !SHA_REGEX.test(sha))
      throw new PluginFetchError("invalid pinned Git SHA.");
    if (forceRefresh && sha !== undefined && (await this.fs.fileExists(targetDir))) {
      await this.verifyPinnedCheckout(targetDir, sha, subpath);
    }
    await this.bustCacheIfNeeded(targetDir, forceRefresh);
  }

  private async fetchNpm(
    source: PluginSourceNpm,
    cacheDir: string,
    forceRefresh: boolean
  ): Promise<string> {
    const { package: pkg, version } = source;
    const pkgDir = join(cacheDir, "node_modules", pkg);
    if (forceRefresh && (await this.fs.fileExists(pkgDir))) {
      await this.fs.deleteDirectory(pkgDir);
    }
    const spec = `${pkg}@${version ?? "latest"}`;
    try {
      await execFile("pnpm", ["add", "--prefix", cacheDir, "--", spec]);
    } catch (err) {
      throw new PluginFetchError(`npm install failed for "${spec}": ${String(err)}`);
    }
    return pkgDir;
  }

  private gitWithNoPrompt(baseDir?: string): ReturnType<typeof simpleGit> {
    const git = simpleGit({ baseDir, allowEnvironment: ["GIT_TERMINAL_PROMPT"] });
    return git.env("GIT_TERMINAL_PROMPT", "0");
  }

  private async cloneShallow(
    authUrl: string,
    displayUrl: string,
    targetDir: string,
    ref?: string,
    canonicalCheckout = false
  ): Promise<void> {
    const args = [
      "--depth",
      "1",
      ...(ref ? ["--branch", ref] : []),
      ...(canonicalCheckout ? ["-c", "core.autocrlf=false", "-c", "core.eol=lf"] : []),
    ];
    try {
      await this.gitWithNoPrompt().clone(authUrl, targetDir, args);
    } catch (err) {
      this.classifyAndThrow(err, displayUrl);
    }
  }

  private async cloneSparse(
    authUrl: string,
    displayUrl: string,
    targetDir: string,
    subpath: string,
    ref?: string,
    canonicalCheckout = false
  ): Promise<void> {
    try {
      await this.gitWithNoPrompt().clone(authUrl, targetDir, [
        "--filter=blob:none",
        "--no-checkout",
        ...(canonicalCheckout ? ["-c", "core.autocrlf=false", "-c", "core.eol=lf"] : []),
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

// Truncation to 64 chars avoids filesystem path-length limits.
// URLs that differ only beyond position 64 will collide — acceptable for typical plugin URLs.
function encodeKey(url: string): string {
  return url.replace(/[^a-zA-Z0-9-]/g, "_").slice(0, 64);
}

function scrubCredentials(msg: string): string {
  return msg.replace(/https:\/\/[^@]+@/g, "https://");
}
