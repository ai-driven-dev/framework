import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "tsup";

// Opt-in native smoke: no provider credentials, prompts, turns, or network access.
// Unlike the deterministic mocked tests, this checks the installed Codex protocol.
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = "/usr/bin/sandbox-exec";
const policy = "(version 1) (allow default) (deny network*)";

function executable(name) {
  const result = spawnSync("which", [name], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) throw new Error(`${name} is required`);
  return realpath(result.stdout.trim().split("\n")[0]);
}

async function run(command, args, env) {
  const child = spawn(command, args, { env, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr += data;
  });
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`${command} failed: ${stderr.trim()}`);
}

async function verifyNetworkBlocked(env) {
  const server = createServer((socket) => socket.end());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address();
    const probe =
      `const s = require('node:net').connect(${port}, '127.0.0.1');\n` +
      "s.on('connect', () => process.exit(2));\n" +
      "s.on('error', e => process.exit(['EACCES', 'EPERM'].includes(e.code) ? 0 : 3));\n" +
      "setTimeout(() => process.exit(4), 3000);";
    await run(sandbox, ["-p", policy, process.execPath, "-e", probe], env);
  } finally {
    await new Promise((done) => server.close(done));
  }
}

function rpc(child) {
  let nextId = 0;
  let stderr = "";
  let failure;
  const pending = new Map();
  child.stderr.on("data", (data) => {
    stderr += data;
  });
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    let response;
    try {
      response = JSON.parse(line);
    } catch {
      return;
    }
    const callback = pending.get(response.id);
    if (!callback) return;
    pending.delete(response.id);
    if (response.error) callback.reject(new Error(response.error.message));
    else callback.resolve(response.result);
  });
  const fail = (error) => {
    failure ??= error;
    for (const callback of pending.values()) callback.reject(failure);
    pending.clear();
  };
  child.on("error", fail);
  child.stdin.on("error", fail);
  child.on("exit", () => fail(new Error(`Codex app-server exited: ${stderr.trim()}`)));
  return {
    request(method, params) {
      if (failure) return Promise.reject(failure);
      const id = ++nextId;
      return new Promise((resolveRequest, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Codex request timed out: ${method}`));
        }, 10_000);
        pending.set(id, {
          resolve(value) {
            clearTimeout(timer);
            resolveRequest(value);
          },
          reject(error) {
            clearTimeout(timer);
            reject(error);
          },
        });
        child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
      });
    },
    notify(method) {
      child.stdin.write(`${JSON.stringify({ method, params: {} })}\n`);
    },
    close() {
      fail(new Error("Codex app-server closed"));
      lines.close();
    },
  };
}

async function stop(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit").then(() => true);
  async function wait() {
    let timer;
    try {
      return await Promise.race([
        exited,
        new Promise((resolveWait) => {
          timer = setTimeout(() => resolveWait(false), 2_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  child.kill();
  if (await wait()) return;
  child.kill("SIGKILL");
  if (await wait()) return;
  child.stdin.destroy();
  child.stdout.destroy();
  child.stderr.destroy();
  child.unref();
  throw new Error("Codex app-server did not exit after SIGKILL");
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error(
      "This native smoke requires macOS sandbox-exec; no unsandboxed fallback is allowed"
    );
  }
  await access(sandbox);
  const codex = await executable("codex");
  const temp = await mkdtemp(join(tmpdir(), "aidd-codex-native-"));
  let child;
  try {
    const home = join(temp, "home");
    const work = join(temp, "work");
    const codexHome = join(home, ".codex");
    await Promise.all([mkdir(codexHome, { recursive: true }), mkdir(work)]);
    const env = {
      PATH: `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
      HOME: home,
      CODEX_HOME: codexHome,
      XDG_CONFIG_HOME: join(home, ".config"),
      XDG_CACHE_HOME: join(home, ".cache"),
      XDG_DATA_HOME: join(home, ".local/share"),
      TMPDIR: temp,
    };
    await verifyNetworkBlocked(env);

    // Bundle the production readers into the temporary directory; no test doubles.
    const metadata = join(
      packageRoot,
      "src/contexts/telemetry/infrastructure/otel/actions/metadata"
    );
    const outDir = join(temp, "readers");
    await build({
      entry: {
        project: join(metadata, "session-project.ts"),
        title: join(metadata, "session-title.ts"),
      },
      outDir,
      format: ["esm"],
      outExtension: () => ({ js: ".mjs" }),
      platform: "node",
      target: "node22",
      config: false,
      clean: false,
      dts: false,
      silent: true,
      splitting: false,
      noExternal: [/.*/],
    });
    const { readSessionProject } = await import(pathToFileURL(join(outDir, "project.mjs")));
    const { readSessionTitle } = await import(pathToFileURL(join(outDir, "title.mjs")));

    child = spawn(sandbox, ["-p", policy, codex, "app-server", "--listen", "stdio://"], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const server = rpc(child);
    try {
      await server.request("initialize", {
        clientInfo: { name: "aidd_native_smoke", version: "1" },
        capabilities: { experimentalApi: true },
      });
      server.notify("initialized");
      const { project } = await server.request("project/create", {
        name: "Synthetic project",
        roots: [{ path: work }],
        idempotencyKey: "aidd-native-smoke",
      });
      const { thread } = await server.request("thread/start", {
        projectId: project.id,
        cwd: work,
        model: "gpt-5",
        approvalPolicy: "never",
      });
      await server.request("thread/name/set", { threadId: thread.id, name: "Synthetic title" });
      const request = (method, params) => server.request(method, params);
      assert.deepEqual(await readSessionTitle(request, thread.id), {
        available: true,
        title: "Synthetic title",
      });
      assert.deepEqual(await readSessionProject(request, thread.id), {
        available: true,
        values: { "aidd.project_id": project.id, "aidd.project_name": "Synthetic project" },
      });
      console.log("PASS: native Codex session title and project readers (network blocked)");
    } finally {
      server.close();
    }
  } finally {
    try {
      await stop(child);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
