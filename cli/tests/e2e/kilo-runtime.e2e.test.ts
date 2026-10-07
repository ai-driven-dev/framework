import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { delimiter, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import { createTestEnv, execFileAsync, runCli, sandboxedEnv } from "./helpers.js";

const describeKiloRuntime = process.env.KILO_RUNTIME_SMOKE === "1" ? describe : describe.skip;
const KILO_PREFIX = join(
  process.env.APPDATA ?? join(process.env.USERPROFILE ?? "", "AppData", "Roaming"),
  "npm",
  "node_modules",
  "@kilocode",
  "cli"
);
const KILO_BIN =
  process.platform !== "win32"
    ? resolveKiloBin()
    : ([
        join(KILO_PREFIX, "node_modules", "@kilocode", "cli-windows-x64", "bin", "kilo.exe"),
        join(
          KILO_PREFIX,
          "node_modules",
          "@kilocode",
          "cli-windows-x64-baseline",
          "bin",
          "kilo.exe"
        ),
        join(KILO_PREFIX, "node_modules", "@kilocode", "cli-windows-arm64", "bin", "kilo.exe"),
      ].find((path) => existsSync(path)) ?? join(process.env.APPDATA ?? "", "npm", "kilo.cmd"));
const KILO_SHELL = KILO_BIN.endsWith(".cmd");

function resolveKiloBin(): string {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (directory === "") continue;
    const candidate = join(directory, "kilo");
    if (existsSync(candidate)) return candidate;
  }
  return "kilo";
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function markerContent(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function localModel() {
  const requests: Array<{ messages: Array<{ role: string; content: unknown }> }> = [];
  let readSent = false;
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      if (request.url !== "/v1/chat/completions") {
        response.writeHead(404).end();
        return;
      }
      const input = JSON.parse(body) as {
        messages: Array<{ role: string; content: unknown }>;
        tools?: Array<{ function: { name: string } }>;
      };
      requests.push(input);
      response.writeHead(200, { "content-type": "text/event-stream" });
      const chunk = (delta: unknown, finish_reason: string | null = null) => {
        response.write(
          `data: ${JSON.stringify({ id: "chatcmpl-local", object: "chat.completion.chunk", created: 1, model: "fake", choices: [{ index: 0, delta, finish_reason }] })}\n\n`
        );
      };
      chunk({ role: "assistant" });
      if (!readSent && input.tools?.some((tool) => tool.function.name === "read")) {
        readSent = true;
        chunk({
          tool_calls: [
            {
              index: 0,
              id: "call_local_read",
              type: "function",
              function: { name: "read", arguments: '{"filePath":"probe.txt"}' },
            },
          ],
        });
        chunk({}, "tool_calls");
      } else {
        chunk({ content: "KILO_LOCAL_READ_CONFIRMED" });
        chunk({}, "stop");
      }
      response.end("data: [DONE]\n\n");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Missing model port");
  return { server, requests, url: `http://127.0.0.1:${address.port}/v1` };
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function startKilo(directory: string, env: NodeJS.ProcessEnv) {
  const child = spawn(KILO_BIN, ["serve", "--hostname", "127.0.0.1", "--port", "0"], {
    cwd: directory,
    env,
    shell: KILO_SHELL,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = deferred<string>();
  let text = "";
  const collect = (chunk: Buffer) => {
    text += chunk.toString();
    const match = text.match(/kilo server listening on http:\/\/127\.0\.0\.1:(\d+)/);
    if (match) output.resolve(match[1]);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  child.on("error", output.reject);
  child.once("exit", (code, signal) =>
    output.reject(new Error(`Kilo exited ${code ?? signal}: ${text}`))
  );
  const timer = setTimeout(() => output.reject(new Error(`Kilo did not start:\n${text}`)), 15000);
  try {
    const port = await output.promise;
    return { child, port };
  } catch (error) {
    await stopKilo(child);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function stopKilo(child: ReturnType<typeof spawn>): Promise<void> {
  const exited = deferred<void>();
  child.once("exit", () => exited.resolve());
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  else exited.resolve();
  if (KILO_SHELL && process.platform === "win32" && child.pid !== undefined) {
    try {
      await execFileAsync("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
    } catch (error) {
      const message = String(error);
      if (
        child.exitCode === null &&
        !message.includes("introuvable") &&
        !message.includes("not found")
      ) {
        throw error;
      }
    }
  }
  await Promise.race([exited.promise, delay(5000)]);
  if (process.platform !== "win32" && child.pid !== undefined) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
  await expect.poll(() => child.exitCode !== null || child.signalCode !== null).toBe(true);
  if (child.pid !== undefined) expect(alive(child.pid)).toBe(false);
}

describeKiloRuntime("E2E: real Kilo runtime", () => {
  it("runs memory and declared hooks exactly once through a real local read-tool turn", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("kilo-runtime");
    let child: ReturnType<typeof spawn> | undefined;
    let kiloUrl: string | undefined;
    const model = await localModel();
    try {
      const generatedProject = join(tempDir, "generated");
      await mkdir(generatedProject, { recursive: true });
      const config = {
        model: "openai-compatible/fake",
        instructions: ["AGENTS.md"],
        provider: {
          "openai-compatible": {
            options: { baseURL: model.url },
            models: {
              fake: { name: "Local fake", tool_call: true, limit: { context: 8192, output: 256 } },
            },
          },
        },
      };
      const configPath = join(generatedProject, "kilo.jsonc");
      await writeFile(configPath, JSON.stringify(config));
      const build = await runCli(
        ["translate", REPOSITORY_ROOT, "--to", "kilo", "--as", "flat", "--out", generatedProject],
        projectDir,
        fakeHome
      );
      expect(build.exitCode, build.stderr).toBe(0);
      expect(JSON.parse(await readFile(configPath, "utf8"))).toMatchObject(config);

      const allowed = new Set([
        "PATH",
        "Path",
        "HOME",
        "USERPROFILE",
        "APPDATA",
        "XDG_CONFIG_HOME",
        "XDG_CACHE_HOME",
        "XDG_DATA_HOME",
        "XDG_STATE_HOME",
        "SystemRoot",
        "SYSTEMROOT",
        "windir",
        "WINDIR",
        "ComSpec",
        "COMSPEC",
        "PATHEXT",
        "TEMP",
        "TMP",
        "LANG",
        "LC_ALL",
        "TZ",
        "KILO_SERVER_PASSWORD",
      ]);
      const env = Object.fromEntries(
        Object.entries(
          sandboxedEnv(fakeHome, {
            XDG_CACHE_HOME: join(fakeHome, ".cache"),
            XDG_DATA_HOME: join(fakeHome, ".local", "share"),
            XDG_STATE_HOME: join(fakeHome, ".local", "state"),
            KILO_SERVER_PASSWORD: "",
          })
        ).filter(([key]) => allowed.has(key))
      );
      const version = await execFileAsync(KILO_BIN, ["--version"], { env, shell: KILO_SHELL });
      expect(version.stdout.trim()).toBe("7.7.5");
      const skills = await execFileAsync(KILO_BIN, ["debug", "skill"], {
        cwd: generatedProject,
        env,
        shell: KILO_SHELL,
        maxBuffer: 8 * 1024 * 1024,
      });
      const discoveredSkills = JSON.parse(skills.stdout) as Array<{ location?: string }>;
      const generatedSkillFiles = (
        await readdir(join(generatedProject, ".kilo", "skills"), {
          recursive: true,
        })
      ).filter((file) => file.replaceAll("\\", "/").endsWith("/SKILL.md")).length;
      expect(
        discoveredSkills.filter((skill) =>
          skill.location?.replaceAll("\\", "/").includes(".kilo/skills/aidd-")
        ).length
      ).toBe(generatedSkillFiles);

      const agents = await execFileAsync(KILO_BIN, ["agent", "list"], {
        cwd: generatedProject,
        env,
        shell: KILO_SHELL,
        maxBuffer: 8 * 1024 * 1024,
      });
      expect(agents.stdout).toContain("aidd-dev-checker");
      expect(agents.stdout).toContain("aidd-dev-executor");

      const mcpProject = join(tempDir, "generated-mcp");
      await mkdir(mcpProject, { recursive: true });
      const mcpBuild = await runCli(
        [
          "translate",
          join(REPOSITORY_ROOT, "cli/tests/fixtures/framework"),
          "--to",
          "kilo",
          "--as",
          "flat",
          "--out",
          mcpProject,
        ],
        projectDir,
        fakeHome
      );
      expect(mcpBuild.exitCode, mcpBuild.stderr).toBe(0);
      const mcp = await execFileAsync(KILO_BIN, ["mcp", "list"], {
        cwd: mcpProject,
        env,
        shell: KILO_SHELL,
        maxBuffer: 8 * 1024 * 1024,
      });
      expect(mcp.stdout).toContain("aidd-test-aidd-test-server");

      const marker = join(generatedProject, "AGENTS.md");
      await mkdir(join(generatedProject, "aidd_docs", "memory"), { recursive: true });
      await writeFile(join(generatedProject, "aidd_docs", "memory", "runtime.md"), "Kilo memory\n");
      await writeFile(
        marker,
        "# Runtime\n\n<!-- aidd_project_memory:start -->\n<!-- aidd_project_memory:end -->\n"
      );
      const bridgePath = join(generatedProject, ".kilo", "plugin", "aidd-context-hooks.js");
      expect(existsSync(bridgePath)).toBe(true);
      const memoryScript = join(
        generatedProject,
        ".kilo",
        "hooks",
        "aidd-context",
        "update_memory.js"
      );
      expect(await readFile(memoryScript, "utf8")).toBe(
        await readFile(
          join(REPOSITORY_ROOT, "plugins", "aidd-context", "hooks", "update_memory.js"),
          "utf8"
        )
      );
      await writeFile(join(generatedProject, "probe.txt"), "KILO_LOCAL_READ_OK\n");
      const payloadPath = join(generatedProject, "payloads.jsonl");
      const eventPath = join(generatedProject, "events.jsonl");
      const root = "$" + "{CLAUDE_PLUGIN_ROOT}";
      const capture = { command: `node ${root}/hooks/capture.js` };
      const proofSource = join(tempDir, "proof-source");
      const proofPlugin = join(proofSource, "plugins", "runtime-proof");
      await mkdir(join(proofSource, ".claude-plugin"), { recursive: true });
      await mkdir(join(proofPlugin, ".claude-plugin"), { recursive: true });
      await mkdir(join(proofPlugin, "hooks"));
      await writeFile(
        join(proofSource, ".claude-plugin", "marketplace.json"),
        JSON.stringify({
          name: "runtime-proof",
          plugins: [{ name: "runtime-proof", source: "./plugins/runtime-proof" }],
        })
      );
      await writeFile(
        join(proofPlugin, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "runtime-proof", version: "1.0.0" })
      );
      await writeFile(
        join(proofPlugin, "hooks", "capture.js"),
        `import { appendFileSync } from "node:fs"; let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => appendFileSync(${JSON.stringify(payloadPath)}, JSON.stringify({ pid: process.pid, payload: JSON.parse(input) }) + "\\n"));`
      );
      await writeFile(
        join(proofPlugin, "hooks", "hooks.json"),
        JSON.stringify({
          hooks: {
            SessionStart: [{ hooks: [capture] }],
            PostToolUse: [{ matcher: "read", hooks: [capture] }],
            Stop: [{ hooks: [capture] }],
          },
        })
      );
      const proofBuild = await runCli(
        ["translate", proofSource, "--to", "kilo", "--as", "flat", "--out", generatedProject],
        projectDir,
        fakeHome
      );
      expect(proofBuild.exitCode, proofBuild.stderr).toBe(0);
      expect(existsSync(join(generatedProject, ".kilo", "plugin", "runtime-proof-hooks.js"))).toBe(
        true
      );
      await writeFile(
        join(generatedProject, ".kilo", "plugin", "observer.js"),
        `import { appendFileSync } from "node:fs"; export default { id: "runtime-observer", server: async () => ({ event: async ({ event }) => appendFileSync(${JSON.stringify(eventPath)}, JSON.stringify(event) + "\\n") }) };`
      );

      const started = await startKilo(generatedProject, env);
      child = started.child;
      kiloUrl = `http://127.0.0.1:${started.port}`;
      const run = await execFileAsync(
        KILO_BIN,
        [
          "run",
          "--attach",
          kiloUrl,
          "--dir",
          generatedProject,
          "--format",
          "json",
          "--auto",
          "--model",
          "openai-compatible/fake",
          "Read probe.txt with the read tool.",
        ],
        {
          cwd: generatedProject,
          env,
          shell: KILO_SHELL,
          timeout: 60000,
          maxBuffer: 8 * 1024 * 1024,
        }
      );
      expect(run.stdout).toContain("KILO_LOCAL_READ_CONFIRMED");
      expect(model.requests.flatMap((request) => request.messages)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "tool",
            content: expect.stringContaining("KILO_LOCAL_READ_OK"),
          }),
        ])
      );
      await expect
        .poll(() => markerContent(marker), { timeout: 5000 })
        .toContain("[aidd_docs/memory/runtime.md](aidd_docs/memory/runtime.md)");
      await expect
        .poll(async () => (await markerContent(payloadPath)).trim().split("\n").length, {
          timeout: 5000,
        })
        .toBe(3);
      const events = (await readFile(eventPath, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const created = events.find((event) => event.type === "session.created");
      const sessionId = created.properties.sessionID;
      expect(sessionId).toEqual(expect.any(String));
      const completed = events.filter(
        (event) =>
          event.type === "message.part.updated" &&
          event.properties.part?.type === "tool" &&
          event.properties.part.state.status === "completed"
      );
      expect(completed).toHaveLength(1);
      expect(completed[0].properties.part.state.output).toContain("KILO_LOCAL_READ_OK");
      expect(events.filter((event) => event.type === "session.idle")).toHaveLength(1);
      const calls = (await readFile(payloadPath, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(calls.map((call) => call.payload)).toEqual(
        expect.arrayContaining([
          { hook_event_name: "SessionStart", session_id: sessionId, cwd: generatedProject },
          {
            hook_event_name: "PostToolUse",
            session_id: sessionId,
            cwd: generatedProject,
            tool_name: "read",
            tool_input: { filePath: "probe.txt" },
          },
          { hook_event_name: "Stop", session_id: sessionId, cwd: generatedProject },
        ])
      );
      for (const call of calls) await expect.poll(() => alive(call.pid)).toBe(false);
      expect(JSON.parse(await readFile(configPath, "utf8"))).toMatchObject(config);
    } finally {
      try {
        if (child) await stopKilo(child);
        if (kiloUrl)
          await expect(fetch(kiloUrl, { signal: AbortSignal.timeout(1000) })).rejects.toThrow();
      } finally {
        try {
          model.server.closeAllConnections();
          await new Promise<void>((resolve, reject) =>
            model.server.close((error) => (error ? reject(error) : resolve()))
          );
          expect(model.server.listening).toBe(false);
        } finally {
          await cleanup();
        }
      }
    }
  }, 120000);
});
