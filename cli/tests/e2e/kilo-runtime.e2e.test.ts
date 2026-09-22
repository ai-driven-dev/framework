import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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

async function waitForMarker(path: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const content = await markerContent(path);
    if (content !== "") return content;
    await delay(100);
  }
  return markerContent(path);
}

async function startKilo(directory: string, env: NodeJS.ProcessEnv) {
  const child = spawn(KILO_BIN, ["serve", "--hostname", "127.0.0.1", "--port", "0"], {
    cwd: directory,
    env,
    shell: KILO_SHELL,
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
  if (child.exitCode === null) {
    child.kill("SIGTERM");
  }
  if (child.exitCode !== null) exited.resolve();
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
}

describeKiloRuntime("E2E: real Kilo runtime", () => {
  it("loads the generated plugin and fires session.created through Kilo", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("kilo-runtime");
    let child: ReturnType<typeof spawn> | undefined;
    try {
      const generatedProject = join(tempDir, "generated");
      await mkdir(generatedProject, { recursive: true });
      const build = await runCli(
        ["translate", REPOSITORY_ROOT, "--to", "kilo", "--as", "flat", "--out", generatedProject],
        projectDir,
        fakeHome
      );
      expect(build.exitCode, build.stderr).toBe(0);

      const env = sandboxedEnv(fakeHome);
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

      const marker = join(generatedProject, "session-start.marker");
      await writeFile(
        join(generatedProject, ".kilo", "hooks", "aidd-context", "update_memory.js"),
        `require("node:fs").appendFileSync(${JSON.stringify(marker)}, "fired\\n");\n`
      );
      const bridgePath = join(generatedProject, ".kilo", "plugin", "aidd-context-hooks.js");
      expect(existsSync(bridgePath)).toBe(true);

      const started = await startKilo(generatedProject, env);
      child = started.child;
      const response = await fetch(`http://127.0.0.1:${started.port}/session`, {
        method: "POST",
        headers: { "x-kilo-directory": generatedProject },
      });
      expect(response.ok).toBe(true);
      expect(await waitForMarker(marker)).toBe("fired\n");
    } finally {
      if (child) await stopKilo(child);
      await cleanup();
    }
  }, 120000);
});
