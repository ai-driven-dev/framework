import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
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
  it("redacts credentials reflected by a real Git server", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "aidd-git-reflect-"));
    const token = "debug-test-secret";
    const encoded = Buffer.from(`tester:${token}`).toString("base64");
    let reached = false;
    const server = createServer((req, res) => {
      reached = true;
      const message = `ERR reflected ${req.headers.authorization}\n`;
      const packet = `${(Buffer.byteLength(message) + 4).toString(16).padStart(4, "0")}${message}`;
      res.writeHead(200, { "Content-Type": "application/x-git-upload-pack-advertisement" });
      res.end(`${packet}0000`);
    });
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("missing server address");
      const url = `http://tester:${token}@127.0.0.1:${address.port}/remote.git`;
      const message = await makeAdapter()
        .fetch({ kind: "url", url }, join(sandbox, "cache"))
        .then(
          () => "unexpected success",
          (error: Error) => error.message
        );
      expect(reached).toBe(true);
      expect(message).not.toBe("unexpected success");
      expect(message).not.toContain(token);
      expect(message).not.toContain(encoded);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(sandbox, { recursive: true, force: true });
    }
  });
  it("does not forward credentials to a different redirect origin", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "aidd-git-redirect-"));
    let seen: string | undefined;
    let reached = false;
    const destination = createServer((req, res) => {
      reached = true;
      seen = req.headers.authorization;
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="test"' }).end();
    });
    await new Promise<void>((resolve) => destination.listen(0, "127.0.0.1", resolve));
    const destAddress = destination.address();
    if (!destAddress || typeof destAddress === "string")
      throw new Error("missing destination address");
    const redirect = createServer((_req, res) => {
      res
        .writeHead(302, {
          Location: `http://localhost:${destAddress.port}/remote.git/info/refs?service=git-upload-pack`,
        })
        .end();
    });
    try {
      await new Promise<void>((resolve) => redirect.listen(0, "127.0.0.1", resolve));
      const address = redirect.address();
      if (!address || typeof address === "string") throw new Error("missing redirect address");
      const url = `http://tester:redirect-secret@127.0.0.1:${address.port}/remote.git`;
      await expect(
        makeAdapter().fetch({ kind: "url", url }, join(sandbox, "cache"))
      ).rejects.toThrow();
      expect(reached).toBe(true);
      expect(seen).toBeUndefined();
    } finally {
      await new Promise<void>((resolve) => redirect.close(() => resolve()));
      await new Promise<void>((resolve) => destination.close(() => resolve()));
      await rm(sandbox, { recursive: true, force: true });
    }
  });
  it("authenticates a real Git HTTP clone without persisting the credential", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "aidd-git-auth-"));
    const repoPath = join(sandbox, "remote.git");
    const workPath = join(sandbox, "work");
    const cacheDir = join(sandbox, "cache");
    const password = "test-only-secret";
    const expected = `Basic ${Buffer.from(`tester:${password}`).toString("base64")}`;
    let authenticatedRequests = 0;
    let injectedHeader = false;
    const gitConfigKeys = [
      "GIT_CONFIG_COUNT",
      "GIT_CONFIG_KEY_0",
      "GIT_CONFIG_VALUE_0",
      "GIT_CONFIG_KEY_1",
      "GIT_CONFIG_VALUE_1",
    ] as const;
    const previousGitConfig = gitConfigKeys.map((key) => process.env[key]);
    const previousHome = process.env.HOME;
    const server = createServer((req, res) => {
      injectedHeader ||= req.headers["x-injected"] !== undefined;
      if (req.headers.authorization !== expected) {
        res.writeHead(401, { "WWW-Authenticate": 'Basic realm="test"' }).end();
        return;
      }
      authenticatedRequests++;
      const url = new URL(req.url ?? "/", "http://localhost");
      const backend = spawn("git", ["http-backend"], {
        env: {
          ...gitEnv(),
          GIT_PROJECT_ROOT: sandbox,
          GIT_HTTP_EXPORT_ALL: "1",
          PATH_INFO: url.pathname,
          QUERY_STRING: url.search.slice(1),
          REQUEST_METHOD: req.method,
          CONTENT_TYPE: req.headers["content-type"],
          CONTENT_LENGTH: req.headers["content-length"],
          REMOTE_USER: "tester",
        },
      });
      req.pipe(backend.stdin);
      let pending = Buffer.alloc(0);
      let started = false;
      backend.stdout.on("data", (chunk: Buffer) => {
        if (started) {
          res.write(chunk);
          return;
        }
        pending = Buffer.concat([pending, chunk]);
        const boundary = pending.indexOf("\r\n\r\n");
        if (boundary < 0) return;
        const headers: Record<string, string> = {};
        let status = 200;
        for (const line of pending.subarray(0, boundary).toString().split("\r\n")) {
          const separator = line.indexOf(":");
          if (separator < 0) continue;
          const key = line.slice(0, separator);
          const value = line.slice(separator + 1).trim();
          if (key.toLowerCase() === "status") status = Number(value.slice(0, 3));
          else headers[key] = value;
        }
        res.writeHead(status, headers);
        res.write(pending.subarray(boundary + 4));
        started = true;
      });
      backend.stdout.on("end", () => res.end());
      backend.on("error", () => res.destroy());
    });
    try {
      await mkdir(workPath, { recursive: true });
      await setupBareRepoWithPlugin(repoPath, workPath);
      await execFileAsync(
        "git",
        ["--git-dir", repoPath, "config", "uploadpack.allowFilter", "true"],
        { env: gitEnv() }
      );
      await execFileAsync(
        "git",
        ["--git-dir", repoPath, "config", "uploadpack.allowAnySHA1InWant", "true"],
        { env: gitEnv() }
      );
      process.env.HOME = sandbox;
      await execFileAsync(
        "git",
        [
          "config",
          "--global",
          "credential.helper",
          `!f() { echo username=tester; echo password=${password}; }; f`,
        ],
        { env: gitEnv() }
      );
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("missing server address");
      const base = `http://127.0.0.1:${address.port}/remote.git`;
      const source = `HTTP://tester:${password}@127.0.0.1:${address.port}/remote.git`;
      process.env.GIT_CONFIG_COUNT = "2";
      process.env.GIT_CONFIG_KEY_0 = "http.extraHeader";
      process.env.GIT_CONFIG_VALUE_0 = "X-Injected: zero";
      process.env.GIT_CONFIG_KEY_1 = "http.extraHeader";
      process.env.GIT_CONFIG_VALUE_1 = "X-Injected: one";
      const local = await makeAdapter().fetch({ kind: "url", url: source, ref: "main" }, cacheDir);
      const config = await readFile(join(local, ".git/config"), "utf8");
      expect(authenticatedRequests).toBeGreaterThan(0);
      expect(injectedHeader).toBe(false);
      expect(config).toContain(base);
      expect(config).not.toContain(password);
      expect(config).not.toContain(Buffer.from(`tester:${password}`).toString("base64"));
      expect(existsSync(join(local, ".claude-plugin/plugin.json"))).toBe(true);

      const helperClone = await new PluginFetcherAdapter(new FileAdapter(new HasherAdapter()), {
        resolve: async () => "github-token-not-for-this-host",
      }).fetch({ kind: "url", url: base, ref: "main" }, join(sandbox, "helper-cache"));
      expect(existsSync(join(helperClone, ".claude-plugin/plugin.json"))).toBe(true);

      const beforeSparse = authenticatedRequests;
      const sparse = await makeAdapter().fetch(
        { kind: "git-subdir", url: source, path: "commands", ref: "main" },
        cacheDir
      );
      expect(authenticatedRequests).toBeGreaterThan(beforeSparse);
      expect(existsSync(join(sparse, "hello.md"))).toBe(true);
      const sparseConfig = await readFile(join(sparse, "..", ".git/config"), "utf8");
      expect(sparseConfig).toContain(base);
      expect(sparseConfig).not.toContain(password);

      const failure = await makeAdapter()
        .fetch(
          { kind: "git-subdir", url: source, path: "commands", ref: "missing-branch" },
          cacheDir
        )
        .then(
          () => "unexpected success",
          (error: Error) => error.message
        );
      expect(failure).not.toBe("unexpected success");
      expect(failure).not.toContain(password);
      expect(failure).not.toContain(Buffer.from(`tester:${password}`).toString("base64"));
      for (const name of await readdir(cacheDir)) {
        const configPath = join(cacheDir, name, ".git/config");
        if (existsSync(configPath)) {
          const saved = await readFile(configPath, "utf8");
          expect(saved).not.toContain(password);
          expect(saved).not.toContain(Buffer.from(`tester:${password}`).toString("base64"));
        }
      }
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      for (const [index, key] of gitConfigKeys.entries()) {
        const previous = previousGitConfig[index];
        if (previous === undefined) delete process.env[key];
        else process.env[key] = previous;
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(sandbox, { recursive: true, force: true });
    }
  });
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
