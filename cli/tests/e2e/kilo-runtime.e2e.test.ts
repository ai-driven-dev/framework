import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import { createTestEnv, runCli, sandboxedEnv } from "./helpers.js";

const execFileAsync = promisify(execFile);

/** Run only when the real Kilo CLI is explicitly requested by the smoke command. */
const describeKiloRuntime = process.env.KILO_RUNTIME_SMOKE === "1" ? describe : describe.skip;

async function markerContent(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function waitForMarker(path: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const content = await markerContent(path);
    if (content !== "") return content;
    await delay(100);
  }
  return markerContent(path);
}

describeKiloRuntime("E2E: real Kilo runtime", () => {
  it("discovers the generated project surface and delivers session.created once", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("kilo-runtime");
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
      const skills = await execFileAsync("kilo", ["debug", "skill"], {
        cwd: generatedProject,
        env,
        maxBuffer: 8 * 1024 * 1024,
      });
      const discoveredSkills = JSON.parse(skills.stdout) as Array<{ location?: string }>;
      expect(
        discoveredSkills.filter((skill) => skill.location?.includes(".kilo/skills/aidd-")).length
      ).toBe(50);

      const agents = await execFileAsync("kilo", ["agent", "list"], {
        cwd: generatedProject,
        env,
        maxBuffer: 8 * 1024 * 1024,
      });
      expect(agents.stdout).toContain("aidd-dev-checker");
      expect(agents.stdout).toContain("aidd-dev-executor");

      const marker = join(generatedProject, "session-start.marker");
      await writeFile(
        join(generatedProject, ".kilo", "hooks", "aidd-context", "update_memory.js"),
        `require("node:fs").appendFileSync(${JSON.stringify(marker)}, "fired\\n");\n`
      );
      const bridgePath = join(generatedProject, ".kilo", "plugin", "aidd-context-hooks.js");
      expect(existsSync(bridgePath)).toBe(true);
      const bridge = (await import(pathToFileURL(bridgePath).href)) as {
        default: {
          server: (options: { directory: string }) => Promise<{
            event: (input: { event: { type: string } }) => Promise<void>;
          }>;
        };
      };
      const server = await bridge.default.server({ directory: generatedProject });
      await server.event({ event: { type: "session.created" } });

      expect(await waitForMarker(marker)).toBe("fired\n");
    } finally {
      await cleanup();
    }
  });
});
