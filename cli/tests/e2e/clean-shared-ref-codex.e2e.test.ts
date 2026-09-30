/**
 * Codex enables a plugin machine-wide (no `NativeActivation.scopeArgs`), so a `clean` here
 * must not disable it. `--plugins none` records no `pluginRefs`, so a real name is passed.
 */
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, pathWithoutAidd, runCli } from "./helpers.js";

const FRAMEWORK_REAL_PATH = resolve(process.cwd(), "tests/fixtures/framework-real");
const PLUGIN_NAME = "aidd-vcs";

/** Every string a parsed JSON tree holds. Asserting against `JSON.stringify` instead compares
 * an escaped rendering: on Windows a path's backslashes come back doubled and match nothing. */
function stringLeavesOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringLeavesOf);
  if (value !== null && typeof value === "object")
    return Object.values(value).flatMap(stringLeavesOf);
  return [];
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf-8")) as Record<string, unknown>;
}

async function writeCodexWithEffectiveSource(
  binDir: string,
  logFile: string,
  stateFile: string,
  configFile: string
): Promise<void> {
  await mkdir(binDir, { recursive: true });
  const script = join(binDir, "codex-fake.mjs");
  await writeFile(
    script,
    [
      'import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";',
      'import { dirname } from "node:path";',
      `const logFile = ${JSON.stringify(logFile)};`,
      `const stateFile = ${JSON.stringify(stateFile)};`,
      `const configFile = ${JSON.stringify(configFile)};`,
      "const args = process.argv.slice(2);",
      'writeFileSync(logFile, args.join(" ") + "\\n", { flag: "a" });',
      'if (args[0] === "plugin" && args[1] === "marketplace" && args[2] === "list" && args[3] === "--json") {',
      '  const path = existsSync(stateFile) ? readFileSync(stateFile, "utf-8") : undefined;',
      '  process.stdout.write(JSON.stringify({ marketplaces: path ? [{ name: "aidd-framework", root: path, marketplaceSource: { sourceType: "local", source: path } }] : [] }));',
      '} else if (args[0] === "plugin" && args[1] === "marketplace" && args[2] === "add") {',
      "  writeFileSync(stateFile, realpathSync(args[3]));",
      '} else if (args[0] === "plugin" && args[1] === "add") {',
      "  mkdirSync(dirname(configFile), { recursive: true });",
      `  if (!existsSync(configFile)) writeFileSync(configFile, ${JSON.stringify('[plugins."')} + args[2] + ${JSON.stringify('"]\nenabled = true\n')});`,
      "}",
      "",
    ].join("\n")
  );
  if (process.platform === "win32") {
    await writeFile(
      join(binDir, "codex.cmd"),
      `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`
    );
  } else {
    await writeFile(
      join(binDir, "codex"),
      `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`,
      {
        mode: 0o755,
      }
    );
  }
}

describe("E2E: clean leaves a codex ref enabled while another project still shares it", () => {
  it("keeps the plugin's ref enabled, names the other project, and never calls plugin remove", async () => {
    const first = await createTestEnv("clean-shared-ref-codex-first");
    const second = await createTestEnv("clean-shared-ref-codex-second");
    try {
      const logFile = join(first.tempDir, "codex-invocations.log");
      const binDir = join(first.tempDir, "bin");
      await writeCodexWithEffectiveSource(
        binDir,
        logFile,
        join(first.tempDir, "codex-marketplace-source.txt"),
        join(first.fakeHome, ".codex", "config.toml")
      );
      const env = { PATH: `${binDir}${delimiter}${pathWithoutAidd()}` };

      const setupArgs = [
        "setup",
        "--source",
        "local",
        "--path",
        FRAMEWORK_REAL_PATH,
        "--ai",
        "codex",
        "--plugins",
        PLUGIN_NAME,
        "--yes",
      ];

      // Both projects share one machine: one `fakeHome` (`first.fakeHome`), never
      // `second.fakeHome`.
      const firstSetup = await runCli(setupArgs, first.projectDir, first.fakeHome, { env });
      expect(firstSetup.exitCode).toBe(0);
      expect(firstSetup.stderr).toBe("");
      const secondSetup = await runCli(setupArgs, second.projectDir, first.fakeHome, { env });
      expect(secondSetup.exitCode).toBe(0);

      const secondRoot = await realpath(second.projectDir);
      const activationLog = await readFile(logFile, "utf-8");
      expect(activationLog).toContain("plugin marketplace add");
      expect(activationLog).toContain("plugin add");
      expect(await readFile(join(first.fakeHome, ".codex", "config.toml"), "utf-8")).toContain(
        `aidd-vcs@aidd-framework`
      );
      const machineManifest = await readJson(
        join(first.fakeHome, ".config", "aidd", "manifest.json")
      );
      expect(stringLeavesOf(machineManifest)).toContain(secondRoot);
      const referencesBefore = await readJson(
        join(first.fakeHome, ".config", "aidd", "references.json")
      );
      expect(Object.values(referencesBefore).flat()).toContain(secondRoot);

      const cleanResult = await runCli(["clean", "--force"], first.projectDir, first.fakeHome, {
        env,
      });

      expect(cleanResult.exitCode).toBe(0);
      expect(cleanResult.stderr).toContain("left enabled");
      expect(cleanResult.stderr).toContain(secondRoot);

      const log = await readFile(logFile, "utf-8");
      expect(log).not.toContain("plugin remove");

      // Second project's own claim survives this project's own clean — it never ran
      // `clean` itself, and the guard is exactly what keeps its plugin loaded too.
      const referencesAfter = await readJson(
        join(first.fakeHome, ".config", "aidd", "references.json")
      );
      expect(Object.values(referencesAfter).flat()).toContain(secondRoot);
      const firstRoot = await realpath(first.projectDir);
      expect(Object.values(referencesAfter).flat()).not.toContain(firstRoot);
    } finally {
      await first.cleanup();
      await second.cleanup();
    }
  });
});
