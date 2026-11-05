import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { PluginFetcherAdapter } from "../../../../src/contexts/distribution/infrastructure/plugin-fetcher-adapter.js";
import { PluginFetchError } from "../../../../src/kernel/errors.js";
import { FileAdapter } from "../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../src/runtime/filesystem/hasher-adapter.js";

const execFileAsync = promisify(execFile);
const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/plugins");

const GIT_ENV_VARS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
];

function gitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of GIT_ENV_VARS) delete env[k];
  env.GIT_AUTHOR_NAME = "Test";
  env.GIT_AUTHOR_EMAIL = "test@example.com";
  env.GIT_COMMITTER_NAME = "Test";
  env.GIT_COMMITTER_EMAIL = "test@example.com";
  return env;
}

async function setupBareRepoWithPlugin(repoPath: string, workPath: string): Promise<void> {
  const env = gitEnv();
  await mkdir(repoPath, { recursive: true });
  await execFileAsync("git", ["init", "--bare", "-b", "main", repoPath], { env });
  await mkdir(join(workPath, ".claude-plugin"), { recursive: true });
  await writeFile(
    join(workPath, ".claude-plugin/plugin.json"),
    '{ "name": "remote-plugin", "version": "1.0.0" }'
  );
  await mkdir(join(workPath, "commands"), { recursive: true });
  await writeFile(
    join(workPath, "commands/hello.md"),
    "---\nname: hello\ndescription: Hi\n---\n\nHello.\n"
  );
  await execFileAsync("git", ["init", "-b", "main"], { cwd: workPath, env });
  await execFileAsync("git", ["add", "."], { cwd: workPath, env });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd: workPath, env });
  await execFileAsync("git", ["push", repoPath, "main"], { cwd: workPath, env });
}

function makeAdapter(): PluginFetcherAdapter {
  return new PluginFetcherAdapter(new FileAdapter(new HasherAdapter()));
}

describe("PluginFetcherAdapter", () => {
  describe("local source", () => {
    it("returns absolute path for existing local plugin", async () => {
      const adapter = makeAdapter();
      const pluginPath = join(FIXTURE_DIR, "claude-format/sample-plugin");
      const result = await adapter.fetch({ kind: "local", path: pluginPath }, "/tmp/cache");
      expect(result).toBe(pluginPath);
    });

    it("throws PluginFetchError for non-existent local path", async () => {
      const adapter = makeAdapter();
      await expect(
        adapter.fetch({ kind: "local", path: "/nonexistent/path/to/plugin" }, "/tmp/cache")
      ).rejects.toThrow(PluginFetchError);
    });
  });

  describe("url source (file:// remote)", () => {
    it("clones a bare git repo and returns the cache path", async () => {
      const sandbox = await mkdtemp(join(tmpdir(), "aidd-fetcher-url-"));
      const repoPath = join(sandbox, "remote.git");
      const workPath = join(sandbox, "work");
      const cacheDir = join(sandbox, "cache");
      try {
        await mkdir(workPath, { recursive: true });
        await setupBareRepoWithPlugin(repoPath, workPath);
        const adapter = makeAdapter();
        const localPath = await adapter.fetch(
          { kind: "url", url: `file://${repoPath}`, ref: "main" },
          cacheDir
        );
        expect(existsSync(join(localPath, ".claude-plugin/plugin.json"))).toBe(true);
        expect(existsSync(join(localPath, "commands/hello.md"))).toBe(true);
      } finally {
        await rm(sandbox, { recursive: true, force: true });
      }
    });

    it("returns cached path on second fetch (skips re-clone)", async () => {
      const sandbox = await mkdtemp(join(tmpdir(), "aidd-fetcher-cache-"));
      const repoPath = join(sandbox, "remote.git");
      const workPath = join(sandbox, "work");
      const cacheDir = join(sandbox, "cache");
      try {
        await mkdir(workPath, { recursive: true });
        await setupBareRepoWithPlugin(repoPath, workPath);
        const adapter = makeAdapter();
        const first = await adapter.fetch(
          { kind: "url", url: `file://${repoPath}`, ref: "main" },
          cacheDir
        );
        await rm(repoPath, { recursive: true, force: true });
        const second = await adapter.fetch(
          { kind: "url", url: `file://${repoPath}`, ref: "main" },
          cacheDir
        );
        expect(second).toBe(first);
        expect(existsSync(join(second, ".claude-plugin/plugin.json"))).toBe(true);
      } finally {
        await rm(sandbox, { recursive: true, force: true });
      }
    });

    it("forceRefresh busts cache and re-clones", async () => {
      const sandbox = await mkdtemp(join(tmpdir(), "aidd-fetcher-refresh-"));
      const repoPath = join(sandbox, "remote.git");
      const workPath = join(sandbox, "work");
      const cacheDir = join(sandbox, "cache");
      try {
        await mkdir(workPath, { recursive: true });
        await setupBareRepoWithPlugin(repoPath, workPath);
        const adapter = makeAdapter();
        await adapter.fetch({ kind: "url", url: `file://${repoPath}`, ref: "main" }, cacheDir);
        const local = await adapter.fetch(
          { kind: "url", url: `file://${repoPath}`, ref: "main" },
          cacheDir,
          { forceRefresh: true }
        );
        expect(existsSync(join(local, ".claude-plugin/plugin.json"))).toBe(true);
      } finally {
        await rm(sandbox, { recursive: true, force: true });
      }
    });
  });

  describe("git-subdir source", () => {
    it("sparse-checkouts a subdirectory from a bare repo", async () => {
      const sandbox = await mkdtemp(join(tmpdir(), "aidd-fetcher-subdir-"));
      const repoPath = join(sandbox, "remote.git");
      const workPath = join(sandbox, "work");
      const cacheDir = join(sandbox, "cache");
      try {
        const env = gitEnv();
        await mkdir(repoPath, { recursive: true });
        await execFileAsync("git", ["init", "--bare", "-b", "main", repoPath], { env });
        await mkdir(join(workPath, "plugins/my-plugin/.claude-plugin"), { recursive: true });
        await writeFile(
          join(workPath, "plugins/my-plugin/.claude-plugin/plugin.json"),
          '{ "name": "my-plugin", "version": "1.0.0" }'
        );
        await mkdir(join(workPath, "plugins/my-plugin/commands"), { recursive: true });
        await writeFile(join(workPath, "plugins/my-plugin/commands/cmd.md"), "Hi.\n");
        await execFileAsync("git", ["init", "-b", "main"], { cwd: workPath, env });
        await execFileAsync("git", ["add", "."], { cwd: workPath, env });
        await execFileAsync("git", ["commit", "-m", "init"], { cwd: workPath, env });
        await execFileAsync("git", ["push", repoPath, "main"], { cwd: workPath, env });

        const adapter = makeAdapter();
        const localPath = await adapter.fetch(
          {
            kind: "git-subdir",
            url: `file://${repoPath}`,
            path: "plugins/my-plugin",
            ref: "main",
          },
          cacheDir
        );
        expect(existsSync(join(localPath, ".claude-plugin/plugin.json"))).toBe(true);
        expect(existsSync(join(localPath, "commands/cmd.md"))).toBe(true);
      } finally {
        await rm(sandbox, { recursive: true, force: true });
      }
    });
  });

  describe("a pinned Git commit", () => {
    it("uses canonical line endings despite user Git config and refuses an intentional CRLF edit", async () => {
      const sandbox = await mkdtemp(join(tmpdir(), "aidd-fetcher-crlf-"));
      const repoPath = join(sandbox, "remote.git");
      const workPath = join(sandbox, "work");
      const cacheDir = join(sandbox, "cache");
      const globalConfig = join(sandbox, "gitconfig");
      const env = gitEnv();
      const previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
      try {
        await mkdir(workPath, { recursive: true });
        await setupBareRepoWithPlugin(repoPath, workPath);
        const sha = (
          await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: workPath, env })
        ).stdout.trim();
        await writeFile(globalConfig, "[core]\n  autocrlf = true\n");
        process.env.GIT_CONFIG_GLOBAL = globalConfig;
        const source = { kind: "url" as const, url: `file://${repoPath}`, ref: "main" };
        const adapter = makeAdapter();
        // The release checkout is first acquired before its SHA is known.
        const clone = await adapter.fetch(source, cacheDir, { canonicalCheckout: true });
        const localAutocrlf = await execFileAsync(
          "git",
          ["config", "--local", "--get", "core.autocrlf"],
          { cwd: clone, env }
        );
        expect(localAutocrlf.stdout.trim()).toBe("false");
        expect(
          (
            await execFileAsync("git", ["config", "--local", "--get", "core.eol"], {
              cwd: clone,
              env,
            })
          ).stdout.trim()
        ).toBe("lf");
        const file = join(clone, "commands/hello.md");
        const original = await readFile(file, "utf8");
        expect(original).not.toContain("\r\n");
        await expect(adapter.fetch({ ...source, sha }, cacheDir)).resolves.toBe(clone);
        // An edited checkout config must not hide a CRLF-only change to the cached file.
        await execFileAsync("git", ["config", "--local", "core.autocrlf", "true"], {
          cwd: clone,
          env,
        });
        await writeFile(file, original.replaceAll("\n", "\r\n"));
        await expect(adapter.fetch({ ...source, sha }, cacheDir)).rejects.toThrow(/modified/i);
        expect(await readFile(file, "utf8")).toBe(original.replaceAll("\n", "\r\n"));

        // A pre-existing noncanonical checkout cannot prove its original bytes; never rewrite it.
        const oldCache = join(sandbox, "old-cache");
        const oldCheckout = join(oldCache, "github-example-project-main");
        await mkdir(oldCache);
        await execFileAsync(
          "git",
          ["-c", "core.autocrlf=true", "clone", `file://${repoPath}`, oldCheckout],
          { env }
        );
        const oldFile = join(oldCheckout, "commands/hello.md");
        expect(await readFile(oldFile, "utf8")).toContain("\r\n");
        const oldSource = { kind: "github" as const, repo: "example/project", ref: "main", sha };
        await expect(adapter.fetch(oldSource, oldCache)).rejects.toThrow(
          /cannot be verified.*noncanonical line endings.*inspect.*manually/i
        );
        await expect(adapter.fetch(oldSource, oldCache, { forceRefresh: true })).rejects.toThrow(
          /cannot be verified.*inspect.*manually/i
        );
        expect(await readFile(oldFile, "utf8")).toContain("\r\n");
      } finally {
        if (previousGlobalConfig === undefined) delete process.env.GIT_CONFIG_GLOBAL;
        else process.env.GIT_CONFIG_GLOBAL = previousGlobalConfig;
        await rm(sandbox, { recursive: true, force: true });
      }
    });

    it("verifies a real checkout and cache, including a moved tag and local edits", async () => {
      const sandbox = await mkdtemp(join(tmpdir(), "aidd-fetcher-pinned-"));
      const repoPath = join(sandbox, "remote.git");
      const workPath = join(sandbox, "work");
      const cacheDir = join(sandbox, "cache");
      const env = gitEnv();
      try {
        await mkdir(workPath, { recursive: true });
        await setupBareRepoWithPlugin(repoPath, workPath);
        const sha = (
          await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: workPath, env })
        ).stdout.trim();
        await execFileAsync("git", ["tag", "v1"], { cwd: workPath, env });
        await execFileAsync("git", ["push", repoPath, "v1"], { cwd: workPath, env });
        const source = {
          kind: "git-subdir" as const,
          url: `file://${repoPath}`,
          path: "commands",
          ref: "v1",
          sha,
        };
        const adapter = makeAdapter();
        const plugin = await adapter.fetch(source, cacheDir);
        expect(existsSync(join(plugin, "hello.md"))).toBe(true);
        expect(
          (
            await execFileAsync("git", ["config", "--local", "--get", "core.autocrlf"], {
              cwd: plugin,
              env,
            })
          ).stdout.trim()
        ).toBe("false");
        expect(await adapter.fetch(source, cacheDir)).toBe(plugin);

        await writeFile(join(plugin, "hello.md"), "locally changed\n");
        await expect(adapter.fetch(source, cacheDir)).rejects.toThrow(/modified|untracked/i);
        await expect(adapter.fetch(source, cacheDir, { forceRefresh: true })).rejects.toThrow(
          /modified|untracked/i
        );
        expect(await readFile(join(plugin, "hello.md"), "utf8")).toBe("locally changed\n");
        await execFileAsync("git", ["checkout", "--", "hello.md"], { cwd: plugin, env });
        await writeFile(join(plugin, "extra.md"), "not from the commit\n");
        await expect(adapter.fetch(source, cacheDir)).rejects.toThrow(/modified|untracked/i);
        await rm(join(plugin, "extra.md"));
        await appendFile(join(plugin, "..", ".git", "info", "exclude"), "\nignored.cache\n");
        await writeFile(join(plugin, "ignored.cache"), "not from the commit\n");
        await expect(adapter.fetch(source, cacheDir)).rejects.toThrow(/ignored/i);
        await rm(join(plugin, "ignored.cache"));
        await execFileAsync("git", ["update-index", "--assume-unchanged", "hello.md"], {
          cwd: plugin,
          env,
        });
        await writeFile(join(plugin, "hello.md"), "hidden change\n");
        await expect(adapter.fetch(source, cacheDir)).rejects.toThrow(/hides tracked/i);
        await execFileAsync("git", ["update-index", "--no-assume-unchanged", "hello.md"], {
          cwd: plugin,
          env,
        });
        await execFileAsync("git", ["checkout", "--", "hello.md"], { cwd: plugin, env });

        await writeFile(join(workPath, "commands/hello.md"), "release moved\n");
        await execFileAsync("git", ["add", "."], { cwd: workPath, env });
        await execFileAsync("git", ["commit", "-m", "next"], { cwd: workPath, env });
        await execFileAsync("git", ["tag", "-f", "v1"], { cwd: workPath, env });
        await execFileAsync("git", ["push", "--force", repoPath, "v1"], { cwd: workPath, env });
        await expect(adapter.fetch(source, cacheDir, { forceRefresh: true })).rejects.toThrow(
          /commit|sha/i
        );
      } finally {
        await rm(sandbox, { recursive: true, force: true });
      }
    });

    it("refuses a GitHub cache whose actual checkout differs from its pinned SHA", async () => {
      const sandbox = await mkdtemp(join(tmpdir(), "aidd-fetcher-github-pin-"));
      const repoPath = join(sandbox, "remote.git");
      const workPath = join(sandbox, "work");
      const cacheDir = join(sandbox, "cache");
      const cached = join(cacheDir, "github-example-project-v1");
      const env = gitEnv();
      try {
        await mkdir(workPath, { recursive: true });
        await setupBareRepoWithPlugin(repoPath, workPath);
        await mkdir(cacheDir, { recursive: true });
        // A managed pinned checkout records canonical EOL settings in its own Git config.
        await execFileAsync(
          "git",
          ["clone", "-c", "core.autocrlf=false", `file://${repoPath}`, cached],
          { env }
        );
        const adapter = makeAdapter();
        const sha = (
          await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: cached, env })
        ).stdout.trim();
        const badGlobalConfig = join(sandbox, "invalid-global-gitconfig");
        await writeFile(badGlobalConfig, "[invalid\n");
        await expect(
          execFileAsync("git", ["rev-parse", "HEAD"], {
            cwd: cached,
            env: { ...env, GIT_CONFIG_GLOBAL: badGlobalConfig },
          })
        ).rejects.toThrow();
        const previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
        process.env.GIT_CONFIG_GLOBAL = badGlobalConfig;
        try {
          // Verification must ignore the user's global config, including a malformed one.
          await expect(
            adapter.fetch({ kind: "github", repo: "example/project", ref: "v1", sha }, cacheDir)
          ).resolves.toBe(cached);
        } finally {
          if (previousGlobalConfig === undefined) delete process.env.GIT_CONFIG_GLOBAL;
          else process.env.GIT_CONFIG_GLOBAL = previousGlobalConfig;
        }
        const source = {
          kind: "github" as const,
          repo: "example/project",
          ref: "v1",
          sha: "0".repeat(40),
        };
        await expect(adapter.fetch(source, cacheDir)).rejects.toThrow(/commit|sha/i);
      } finally {
        await rm(sandbox, { recursive: true, force: true });
      }
    });
  });
});
