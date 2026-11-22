import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { GitCloner } from "../../../../src/contexts/distribution/infrastructure/git-cloner-adapter.js";
import { PluginFetcherAdapter } from "../../../../src/contexts/distribution/infrastructure/plugin-fetcher-adapter.js";
import { PnpmInstallerAdapter } from "../../../../src/contexts/distribution/infrastructure/pnpm-installer-adapter.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";

const execFileAsync = promisify(execFile);

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
  return new PluginFetcherAdapter(new FileAdapter(), new GitCloner(), new PnpmInstallerAdapter());
}

describe("fetching a plugin source", () => {
  describe("url source (file:// remote)", () => {
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
});
