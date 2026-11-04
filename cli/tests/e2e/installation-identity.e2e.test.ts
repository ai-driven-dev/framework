import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

describe.skipIf(process.platform === "win32")("installation identity across commands", () => {
  it("reuses the setup ID for telemetry and keeps a manually chosen person ID", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("installation-id");
    const userConfig = join(fakeHome, ".config", "aidd");
    const path = join(userConfig, "installation", "id.json");
    const person = join(userConfig, "telemetry", "identity.json");
    const collector = join(fakeHome, ".local", "share", "aidd-otel-observation");
    try {
      await mkdir(join(userConfig, "telemetry"), { recursive: true });
      await writeFile(person, '{"person_id":"existing-person"}\n', { mode: 0o600 });
      const setup = [
        "setup",
        "--source",
        "local",
        "--path",
        FRAMEWORK_PATH,
        "--ai",
        "claude",
        "--plugins",
        "none",
        "--yes",
      ];
      expect((await runCli(setup, projectDir, fakeHome)).exitCode).toBe(0);
      const first = await readFile(path, "utf8");
      expect((await runCli(setup, projectDir, fakeHome)).exitCode).toBe(0);
      expect(await readFile(path, "utf8")).toBe(first);
      execFileSync("git", ["init", "--quiet"], { cwd: projectDir });
      const turnOn = await runCli(["telemetry", "on", "--yes"], projectDir, fakeHome);
      expect(turnOn.exitCode, turnOn.stderr).toBe(0);
      expect(await readFile(path, "utf8")).toBe(first);
      await mkdir(collector, { recursive: true });
      await writeFile(join(collector, "collector-token"), "test-token", { mode: 0o600 });
      expect(
        (
          await runCli(
            ["telemetry", "otel", "init", "--config=codex", "--endpoint=dev"],
            projectDir,
            fakeHome
          )
        ).exitCode
      ).toBe(0);
      expect(await readFile(path, "utf8")).toBe(first);
      expect(await readFile(person, "utf8")).toBe('{"person_id":"existing-person"}\n');
    } finally {
      await cleanup();
    }
  });

  it("does not create an installation ID when OTLP production initialization is refused", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("installation-refused");
    try {
      const result = await runCli(
        ["telemetry", "otel", "init", "--config=codex", "--endpoint=prod"],
        projectDir,
        fakeHome
      );
      expect(result.exitCode).not.toBe(0);
      await expect(
        stat(join(fakeHome, ".config", "aidd", "installation", "id.json"))
      ).rejects.toThrow();
    } finally {
      await cleanup();
    }
  });

  it("creates and reuses the ID through OTLP initialization for an existing installation", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("installation-otel");
    const path = join(fakeHome, ".config", "aidd", "installation", "id.json");
    const collector = join(fakeHome, ".local", "share", "aidd-otel-observation");
    try {
      await mkdir(collector, { recursive: true });
      await writeFile(join(collector, "collector-token"), "test-token", { mode: 0o600 });
      const args = ["telemetry", "otel", "init", "--config=codex", "--endpoint=dev"];
      expect((await runCli(args, projectDir, fakeHome)).exitCode).toBe(0);
      const initial = await readFile(path, "utf8");
      expect((await runCli(args, projectDir, fakeHome)).exitCode).toBe(0);
      expect(await readFile(path, "utf8")).toBe(initial);
    } finally {
      await cleanup();
    }
  });

  it("creates the ID when measurement is enabled and not when it is refused", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("installation-on");
    const path = join(fakeHome, ".config", "aidd", "installation", "id.json");
    const args = ["telemetry", "on", "--yes", "--anonymous"];
    try {
      expect((await runCli(args, projectDir, fakeHome)).exitCode).not.toBe(0);
      await expect(stat(path)).rejects.toThrow();
      execFileSync("git", ["init", "--quiet"], { cwd: projectDir });
      expect((await runCli(args, projectDir, fakeHome)).exitCode).toBe(0);
      const initial = await readFile(path, "utf8");
      expect((await runCli(args, projectDir, fakeHome)).exitCode).toBe(0);
      expect(await readFile(path, "utf8")).toBe(initial);
    } finally {
      await cleanup();
    }
  });

  it("does not initialize a project over an invalid existing installation ID", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("installation-invalid");
    const directory = join(fakeHome, ".config", "aidd", "installation");
    const path = join(directory, "id.json");
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(path, '{"installation_id":"invalid"}', { mode: 0o600 });
      const result = await runCli(
        [
          "setup",
          "--source",
          "local",
          "--path",
          FRAMEWORK_PATH,
          "--ai",
          "claude",
          "--plugins",
          "none",
          "--yes",
        ],
        projectDir,
        fakeHome
      );
      expect(result.exitCode).not.toBe(0);
      await expect(stat(join(projectDir, ".aidd", "manifest.json"))).rejects.toThrow();
      expect(await readFile(path, "utf8")).toBe('{"installation_id":"invalid"}');
    } finally {
      await cleanup();
    }
  });
});
