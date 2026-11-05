import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { delimiter, dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { cliPath, createTestEnv, runCli, sandboxedEnv, writeFakeToolBinary } from "./helpers.js";

const hook = 'process.stdout.write(JSON.stringify({systemMessage:"MAINTENANCE NOTICE"}));';
const hash = createHash("md5").update(hook).digest("hex");

async function writeHost(bin: string, tool: string, body: string) {
  await mkdir(bin, { recursive: true });
  const script = join(bin, "host.cjs");
  await writeFile(script, body);
  if (process.platform === "win32") {
    await writeFile(
      join(bin, `${tool}.cmd`),
      `@echo off\r\n"${process.execPath}" "%~dp0host.cjs" %*\r\n`
    );
  } else {
    const binary = join(bin, tool);
    await writeFile(binary, `#!/usr/bin/env node\n${body}`);
    await chmod(binary, 0o755);
  }
}

async function installed(root: string, tool: "opencode" | "kilo", scope: "project" | "user") {
  const relative =
    scope === "project"
      ? `.${tool}/hooks/aidd-maintenance/session-start.cjs`
      : "hooks/aidd-maintenance/session-start.cjs";
  const base = scope === "project" ? root : join(root, ".config", tool);
  const manifest =
    scope === "project"
      ? join(root, ".aidd", "manifest.json")
      : join(root, ".config", "aidd", "manifest.json");
  await mkdir(dirname(join(base, relative)), { recursive: true });
  await mkdir(dirname(manifest), { recursive: true });
  await writeFile(join(base, relative), hook);
  await writeFile(
    manifest,
    JSON.stringify({
      version: 8,
      tools: {
        [tool]: {
          toolId: tool,
          version: "5.6.0",
          files: [],
          plugins: [
            {
              name: "aidd-maintenance",
              version: "0.1.0",
              source: { kind: "local", path: "/source" },
              strict: false,
              scope,
              marketplace: "aidd-framework",
              files: { [relative]: hash },
            },
          ],
        },
      },
    })
  );
}

describe("aidd run", () => {
  it.each(["opencode", "kilo"] as const)(
    "shows the recorded %s project hook and forwards arguments",
    async (tool) => {
      const env = await createTestEnv(`run-${tool}`);
      try {
        await installed(env.projectDir, tool, "project");
        const childDir = join(env.projectDir, "nested");
        const bin = join(env.tempDir, "bin");
        const log = join(env.tempDir, "args.txt");
        await mkdir(childDir);
        await writeHost(
          bin,
          tool,
          `require("node:fs").writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));`
        );
        const result = await runCli(
          ["run", tool, "--", "--format", "json", "hello world"],
          childDir,
          env.fakeHome,
          { env: { PATH: `${bin}${delimiter}${dirname(process.execPath)}` } }
        );
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("MAINTENANCE NOTICE");
        expect(JSON.parse(await readFile(log, "utf8"))).toEqual([
          "run",
          "--format",
          "json",
          "hello world",
        ]);
      } finally {
        await env.cleanup();
      }
    }
  );

  it("loads an explicitly recorded global hook", async () => {
    const env = await createTestEnv("run-global");
    try {
      await installed(env.fakeHome, "opencode", "user");
      const bin = join(env.tempDir, "bin");
      await writeFakeToolBinary(bin, "opencode", join(env.tempDir, "args.txt"));
      const result = await runCli(["run", "opencode", "--", "hi"], env.projectDir, env.fakeHome, {
        env: { PATH: `${bin}${delimiter}${dirname(process.execPath)}` },
      });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("MAINTENANCE NOTICE");
    } finally {
      await env.cleanup();
    }
  });

  it.each(["opencode", "kilo"] as const)(
    "refuses competing %s project and global copies",
    async (tool) => {
      const env = await createTestEnv(`run-conflict-${tool}`);
      try {
        await installed(env.projectDir, tool, "project");
        await installed(env.fakeHome, tool, "user");
        const result = await runCli(["run", tool, "--", "hi"], env.projectDir, env.fakeHome);
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toMatch(/project and global copies coexist/i);
        expect(result.stderr).not.toContain("MAINTENANCE NOTICE");
      } finally {
        await env.cleanup();
      }
    }
  );

  it.each([
    ["opencode", "OPENCODE_CONFIG_DIR"],
    ["kilo", "KILO_CONFIG_DIR"],
  ] as const)(
    "refuses %s when an extra config directory can replace its plugin",
    async (tool, key) => {
      const env = await createTestEnv(`run-override-${tool}`);
      try {
        await installed(env.projectDir, tool, "project");
        const result = await runCli(["run", tool, "--", "hi"], env.projectDir, env.fakeHome, {
          env: { [key]: join(env.tempDir, "override") },
        });
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain(key);
        expect(result.stderr).not.toContain("MAINTENANCE NOTICE");
      } finally {
        await env.cleanup();
      }
    }
  );

  it("honors XDG_CONFIG_HOME and never falls back to an ignored home hook", async () => {
    const env = await createTestEnv("run-xdg");
    try {
      await installed(env.fakeHome, "opencode", "user");
      const xdg = join(env.tempDir, "custom-xdg");
      const bin = join(env.tempDir, "bin");
      await writeFakeToolBinary(bin, "opencode", join(env.tempDir, "args.txt"));
      const childEnv = {
        ...sandboxedEnv(env.fakeHome, { PATH: `${bin}${delimiter}${dirname(process.execPath)}` }),
        XDG_CONFIG_HOME: xdg,
      };
      const run = () =>
        spawnSync(process.execPath, [cliPath(), "run", "opencode", "--", "hi"], {
          cwd: env.projectDir,
          env: childEnv,
          encoding: "utf8",
        });
      const ignored = run();
      expect(ignored.status).not.toBe(0);
      expect(ignored.stderr).not.toContain("MAINTENANCE NOTICE");
      const file = join(xdg, "opencode/hooks/aidd-maintenance/session-start.cjs");
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, hook);
      const loaded = run();
      expect(loaded.status).toBe(0);
      expect(loaded.stderr).toContain("MAINTENANCE NOTICE");
    } finally {
      await env.cleanup();
    }
  });

  it("refuses a hook not recorded in the manifest before starting the tool", async () => {
    const env = await createTestEnv("run-untracked");
    try {
      const file = join(env.projectDir, ".opencode/hooks/aidd-maintenance/session-start.cjs");
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, hook);
      const result = await runCli(["run", "opencode", "--", "hi"], env.projectDir, env.fakeHome);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/maintenance.*install/i);
      expect(result.stderr).not.toContain("MAINTENANCE NOTICE");
    } finally {
      await env.cleanup();
    }
  });

  it("refuses a modified hook rather than executing it", async () => {
    const env = await createTestEnv("run-modified");
    try {
      await installed(env.projectDir, "kilo", "project");
      await writeFile(
        join(env.projectDir, ".kilo/hooks/aidd-maintenance/session-start.cjs"),
        'throw Error("must not run")'
      );
      const result = await runCli(["run", "kilo", "--", "hi"], env.projectDir, env.fakeHome);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/modified/i);
      expect(result.stderr).not.toContain("must not run");
    } finally {
      await env.cleanup();
    }
  });

  it("keeps JSON stdout and passes metacharacters literally even when an update is cached", async () => {
    const env = await createTestEnv("run-json");
    try {
      await installed(env.projectDir, "opencode", "project");
      const cache = join(env.fakeHome, ".config/aidd/cache/update-check.json");
      await mkdir(dirname(cache), { recursive: true });
      await writeFile(cache, JSON.stringify({ checkedAt: Date.now(), latest: "999.0.0" }));
      const bin = join(env.tempDir, "bin");
      await writeHost(
        bin,
        "opencode",
        "process.stdout.write(JSON.stringify(process.argv.slice(2)))"
      );
      const value = "a & b $(nope) %PATH%";
      const result = await runCli(
        ["run", "opencode", "--", "--format", "json", value],
        env.projectDir,
        env.fakeHome,
        {
          env: {
            PATH: `${bin}${delimiter}${dirname(process.execPath)}`,
            AIDD_SKIP_UPDATE_CHECK: "0",
          },
        }
      );
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual(["run", "--format", "json", value]);
      expect(result.stderr).toContain("MAINTENANCE NOTICE");
      expect(result.stderr).not.toContain("CLI update available");
    } finally {
      await env.cleanup();
    }
  });

  it("forwards stdin and the tool exit status", async () => {
    const env = await createTestEnv("run-stdin");
    try {
      await installed(env.projectDir, "kilo", "project");
      const bin = join(env.tempDir, "bin");
      await writeHost(
        bin,
        "kilo",
        'process.stdin.setEncoding("utf8");let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{process.stdout.write(s);process.exitCode=7;});'
      );
      const result = await new Promise<{ code: number | null; out: string; err: string }>(
        (resolvePromise, reject) => {
          const child = spawn(
            process.execPath,
            [cliPath(), "run", "kilo", "--", "--format", "json"],
            {
              cwd: env.projectDir,
              env: sandboxedEnv(env.fakeHome, {
                PATH: `${bin}${delimiter}${dirname(process.execPath)}`,
              }),
              stdio: ["pipe", "pipe", "pipe"],
            }
          );
          let out = "",
            err = "";
          child.stdout.on("data", (chunk) => {
            out += chunk;
          });
          child.stderr.on("data", (chunk) => {
            err += chunk;
          });
          child.once("error", reject);
          child.once("close", (code) => resolvePromise({ code, out, err }));
          child.stdin.end("stdin payload");
        }
      );
      expect(result.code).toBe(7);
      expect(result.out).toBe("stdin payload");
      expect(result.err).toContain("MAINTENANCE NOTICE");
    } finally {
      await env.cleanup();
    }
  });

  it("reports a missing executable and refuses remote or interactive targets", async () => {
    const env = await createTestEnv("run-missing");
    try {
      await installed(env.projectDir, "kilo", "project");
      const missing = await runCli(["run", "kilo", "--", "hello"], env.projectDir, env.fakeHome, {
        env: { PATH: env.tempDir },
      });
      expect(missing.exitCode).not.toBe(0);
      expect(missing.stderr).toMatch(/unable to start kilo/i);
      for (const args of [["--attach", "http://localhost:4096"], ["--interactive"], ["--pure"]]) {
        const result = await runCli(["run", "kilo", "--", ...args], env.projectDir, env.fakeHome);
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).not.toContain("MAINTENANCE NOTICE");
      }
    } finally {
      await env.cleanup();
    }
  });

  it("uses Kilo's --dir project when locating the hook", async () => {
    const env = await createTestEnv("run-dir");
    try {
      await installed(env.projectDir, "kilo", "project");
      const bin = join(env.tempDir, "bin");
      await writeFakeToolBinary(bin, "kilo", join(env.tempDir, "args.txt"));
      const result = await runCli(
        ["run", "kilo", "--", "--dir", env.projectDir, "hi"],
        env.tempDir,
        env.fakeHome,
        { env: { PATH: `${bin}${delimiter}${dirname(process.execPath)}` } }
      );
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("MAINTENANCE NOTICE");
    } finally {
      await env.cleanup();
    }
  });

  it.skipIf(process.platform === "win32")(
    "forwards termination to the tool and preserves the signal",
    async () => {
      const env = await createTestEnv("run-signal");
      try {
        await installed(env.projectDir, "opencode", "project");
        const bin = join(env.tempDir, "bin");
        await writeHost(
          bin,
          "opencode",
          'process.stdout.write("READY\\n"); setInterval(()=>{},1000);'
        );
        const result = await new Promise<{ signal: NodeJS.Signals | null; out: string }>(
          (resolvePromise, reject) => {
            const child = spawn(process.execPath, [cliPath(), "run", "opencode", "--", "hi"], {
              cwd: env.projectDir,
              env: sandboxedEnv(env.fakeHome, {
                PATH: `${bin}${delimiter}${dirname(process.execPath)}`,
              }),
              stdio: ["ignore", "pipe", "pipe"],
            });
            let out = "";
            let err = "";
            const timeout = setTimeout(() => {
              child.kill("SIGKILL");
              reject(new Error("Tool did not become ready"));
            }, 10000);
            child.stdout.on("data", (chunk) => {
              out += chunk;
              if (out.includes("READY")) child.kill("SIGTERM");
            });
            child.stderr.on("data", (chunk) => {
              err += chunk;
            });
            child.once("error", reject);
            child.once("close", (_code, signal) => {
              clearTimeout(timeout);
              if (!out.includes("READY")) {
                reject(new Error(`Tool exited before becoming ready: ${err}`));
                return;
              }
              resolvePromise({ signal, out });
            });
          }
        );
        expect(result.out).toContain("READY");
        expect(result.signal).toBe("SIGTERM");
      } finally {
        await env.cleanup();
      }
    }
  );
});
