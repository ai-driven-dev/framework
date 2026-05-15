/**
 * Sync-matrix E2E — plugin propagation inter-tool (20 pairs)
 * Automated counterpart of:
 *   aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-sync-matrix.md
 * DDD audit Q4 #3 (HIGH ROI):
 *   aidd_docs/tasks/2026_05/2026_05_07-cli-v5-ddd-audit.md
 *
 * Method: marketplace-registered plugin installed on source, then
 * `plugin sync --source S --target T` propagates it to target.
 * Local-path (`plugin add`) plugins cannot propagate — that is by design.
 *
 * OpenCode included: capabilities fully implemented in opencode.ts (Part 3).
 * HasHooks intentionally absent (no hook equivalent in OpenCode — locked decision).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

// Fixture: claude-format sample-plugin (simplest fixture with real plugin.json)
const PLUGIN_FIXTURE = resolve(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

const PLUGIN_NAME = "sample-plugin";

const TOOLS = ["claude", "cursor", "copilot", "codex", "opencode"] as const;
type Tool = (typeof TOOLS)[number];

const PAIRS: Array<{ source: Tool; target: Tool }> = TOOLS.flatMap((s) =>
  TOOLS.filter((t) => t !== s).map((t) => ({ source: s, target: t }))
);

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

async function seedManifest(projectDir: string): Promise<void> {
  await mkdir(join(projectDir, ".aidd"), { recursive: true });
  await writeFile(
    join(projectDir, ".aidd", "manifest.json"),
    JSON.stringify({ version: 5, tools: {}, marketplaces: {} }),
    "utf-8"
  );
}

async function writeMarketplace(marketDir: string): Promise<void> {
  await mkdir(join(marketDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    join(marketDir, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      plugins: [
        {
          name: PLUGIN_NAME,
          source: { kind: "local", path: PLUGIN_FIXTURE },
          version: "1.0.0",
        },
      ],
    }),
    "utf-8"
  );
}

async function readManifest(
  projectDir: string
): Promise<{ tools: Record<string, { plugins?: Array<{ name: string }> }> }> {
  const raw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
  return JSON.parse(raw) as { tools: Record<string, { plugins?: Array<{ name: string }> }> };
}

function targetHasPlugin(
  manifest: { tools: Record<string, { plugins?: Array<{ name: string }> }> },
  tool: string,
  pluginName: string
): boolean {
  return (manifest.tools[tool]?.plugins ?? []).some((p) => p.name === pluginName);
}

// -------------------------------------------------------------------------
// 12-pair matrix
// -------------------------------------------------------------------------

describe.concurrent("sync matrix: plugin propagation inter-tool (20 pairs)", () => {
  for (const { source, target } of PAIRS) {
    it(`${source} → ${target} propagates installed plugin`, async () => {
      const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv(
        `sync-${source}-${target}`
      );
      try {
        await seedManifest(projectDir);

        // Install source and target AI tools
        await runCli(["ai", "install", source], projectDir, fakeHome);
        await runCli(["ai", "install", target], projectDir, fakeHome);

        // Register a local marketplace
        const marketDir = join(tempDir, "market");
        await writeMarketplace(marketDir);
        await runCli(["marketplace", "add", "local", marketDir, "--yes"], projectDir, fakeHome);

        // Install plugin on source tool
        await runCli(["plugin", "install", PLUGIN_NAME, "--tool", source], projectDir, fakeHome);

        // Propagate to target via plugin sync
        const result = await runCli(
          ["plugin", "sync", "--source", source, "--target", target],
          projectDir,
          fakeHome
        );

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Propagated");

        // Manifest must record the plugin on the target tool
        const manifest = await readManifest(projectDir);
        expect(targetHasPlugin(manifest, target, PLUGIN_NAME)).toBe(true);
      } finally {
        await cleanup();
      }
    });
  }
});

// -------------------------------------------------------------------------
// Negative cases
// -------------------------------------------------------------------------

describe.concurrent("sync matrix: negative cases", () => {
  it("ai sync --source claude --target claude exits 1 (source and target identical)", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("sync-self-pair");
    try {
      await seedManifest(projectDir);
      await runCli(["ai", "install", "claude"], projectDir, fakeHome);
      await runCli(["ai", "install", "cursor"], projectDir, fakeHome);

      const { exitCode, stderr } = await runCli(
        ["ai", "sync", "--source", "claude", "--target", "claude"],
        projectDir,
        fakeHome
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toMatch(/same tool|source and target/i);
    } finally {
      await cleanup();
    }
  });

  it("plugin sync with no plugins on source exits 0 and reports in sync", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("sync-no-plugins");
    try {
      await seedManifest(projectDir);
      await runCli(["ai", "install", "claude"], projectDir, fakeHome);
      await runCli(["ai", "install", "cursor"], projectDir, fakeHome);

      const { exitCode, stdout } = await runCli(
        ["plugin", "sync", "--source", "claude", "--target", "cursor"],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/[Pp]lugins are in sync|[Nn]othing to sync/);
    } finally {
      await cleanup();
    }
  });
});
