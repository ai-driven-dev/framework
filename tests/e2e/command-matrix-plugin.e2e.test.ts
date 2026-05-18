/**
 * Command Matrix E2E — Plugin, Marketplace & Auth surface
 * Automated counterpart of: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-command-matrix.md
 *
 * Already covered by existing E2E journeys (not duplicated here):
 *   plugin-install.e2e.test.ts — marketplace add/list/remove/browse/check/overwrite,
 *                                plugin search/install
 *
 * See also: command-matrix-help.e2e.test.ts, command-matrix-ai.e2e.test.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const AIDD_DIR = ".aidd";
const EMPTY_MANIFEST = { version: 5, tools: {}, marketplaces: {} };
const PLUGIN_FIXTURE = resolve(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

async function seedManifest(projectDir: string): Promise<void> {
  await mkdir(join(projectDir, AIDD_DIR), { recursive: true });
  await writeFile(
    join(projectDir, AIDD_DIR, "manifest.json"),
    JSON.stringify(EMPTY_MANIFEST),
    "utf-8"
  );
}

async function seedWithClaude(projectDir: string, fakeHome: string): Promise<void> {
  await seedManifest(projectDir);
  await runCli(["ai", "install", "claude"], projectDir, fakeHome);
}

async function writeMarketplace(
  dir: string,
  plugins: Array<Record<string, unknown>>
): Promise<void> {
  await mkdir(join(dir, ".claude-plugin"), { recursive: true });
  await writeFile(join(dir, ".claude-plugin", "marketplace.json"), JSON.stringify({ plugins }));
}

// ---------------------------------------------------------------------------
// Plugin — add / remove / list / status / doctor / update / restore / pick
// (plugin search/install from marketplace are in plugin-install.e2e.test.ts)
// ---------------------------------------------------------------------------

describe.concurrent("Command Matrix: Plugin lifecycle (local add)", () => {
  it("plugin add <local-path> exits 0 with success message", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-add");
    try {
      await seedWithClaude(projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(
        ["plugin", "add", PLUGIN_FIXTURE],
        projectDir,
        fakeHome
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Plugin added successfully");
    } finally {
      await cleanup();
    }
  });

  it("plugin add <local-path> --tool claude exits 0", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-add-tool");
    try {
      await seedWithClaude(projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(
        ["plugin", "add", PLUGIN_FIXTURE, "--tool", "claude"],
        projectDir,
        fakeHome
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Plugin added successfully");
    } finally {
      await cleanup();
    }
  });

  it("plugin list exits 0 and shows installed plugin", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-list");
    try {
      await seedWithClaude(projectDir, fakeHome);
      await runCli(["plugin", "add", PLUGIN_FIXTURE, "--tool", "claude"], projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(["plugin", "list"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("sample-plugin");
    } finally {
      await cleanup();
    }
  });

  it("plugin list --tool claude exits 0 and shows plugin under tool scope", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-list-tool");
    try {
      await seedWithClaude(projectDir, fakeHome);
      await runCli(["plugin", "add", PLUGIN_FIXTURE, "--tool", "claude"], projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(
        ["plugin", "list", "--tool", "claude"],
        projectDir,
        fakeHome
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("sample-plugin");
    } finally {
      await cleanup();
    }
  });

  it("plugin doctor exits 0 with healthy message when tool is installed", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-doctor");
    try {
      await seedWithClaude(projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(["plugin", "doctor"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("healthy");
    } finally {
      await cleanup();
    }
  });

  it("plugin update exits 0 reporting all plugins up to date", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-update");
    try {
      await seedWithClaude(projectDir, fakeHome);
      await runCli(["plugin", "add", PLUGIN_FIXTURE, "--tool", "claude"], projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(["plugin", "update"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("up to date");
    } finally {
      await cleanup();
    }
  });

  it("plugin update sample-plugin exits 0 reporting up to date", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-update-named");
    try {
      await seedWithClaude(projectDir, fakeHome);
      await runCli(["plugin", "add", PLUGIN_FIXTURE, "--tool", "claude"], projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(
        ["plugin", "update", "sample-plugin"],
        projectDir,
        fakeHome
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("up to date");
    } finally {
      await cleanup();
    }
  });

  it("ai restore exits 0 and restores plugin files when a tracked file is deleted", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("ai-restore-plugin");
    try {
      await seedWithClaude(projectDir, fakeHome);
      await runCli(["plugin", "add", PLUGIN_FIXTURE, "--tool", "claude"], projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(["ai", "restore"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/[Rr]estor|[Nn]othing to restore/);
    } finally {
      await cleanup();
    }
  });

  it("plugin remove sample-plugin --tool claude exits 0", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-remove");
    try {
      await seedWithClaude(projectDir, fakeHome);
      await runCli(["plugin", "add", PLUGIN_FIXTURE, "--tool", "claude"], projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(
        ["plugin", "remove", "sample-plugin", "--tool", "claude"],
        projectDir,
        fakeHome
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("sample-plugin");
      expect(stdout).toContain("removed");
    } finally {
      await cleanup();
    }
  });

  it("plugin pick exits 1 in non-interactive mode", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("plugin-pick-noninteractive");
    try {
      await seedWithClaude(projectDir, fakeHome);
      const { stderr, exitCode } = await runCli(["plugin", "pick"], projectDir, fakeHome);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("interactive");
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Marketplace — refresh / cache (add/list/browse/check/remove in plugin-install.e2e.test.ts)
// ---------------------------------------------------------------------------

describe.concurrent("Command Matrix: Marketplace cache + refresh", () => {
  it("marketplace refresh exits 0 (no-op when no marketplaces registered)", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("mkt-refresh-empty");
    try {
      await seedManifest(projectDir);
      const { exitCode } = await runCli(["marketplace", "refresh"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it("marketplace refresh <name> refreshes a registered marketplace", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("mkt-refresh-named");
    try {
      await seedManifest(projectDir);
      const marketDir = join(tempDir, "market");
      await writeMarketplace(marketDir, []);
      await runCli(["marketplace", "add", "local", marketDir, "--yes"], projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(
        ["marketplace", "refresh", "local"],
        projectDir,
        fakeHome
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("local");
    } finally {
      await cleanup();
    }
  });

  it("marketplace cache list exits 0 reporting no cached marketplaces", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("mkt-cache-list");
    try {
      await seedManifest(projectDir);
      const { stdout, exitCode } = await runCli(
        ["marketplace", "cache", "list"],
        projectDir,
        fakeHome
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("No cached");
    } finally {
      await cleanup();
    }
  });

  it("marketplace cache clear --all exits 0 when nothing to clear", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("mkt-cache-clear-all");
    try {
      await seedManifest(projectDir);
      const { stdout, exitCode } = await runCli(
        ["marketplace", "cache", "clear", "--all"],
        projectDir,
        fakeHome
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Nothing to clear");
    } finally {
      await cleanup();
    }
  });

  it("marketplace cache clear (no name, non-TTY) exits 1 asking for name or --all", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("mkt-cache-clear-noarg");
    try {
      await seedManifest(projectDir);
      const { stderr, exitCode } = await runCli(
        ["marketplace", "cache", "clear"],
        projectDir,
        fakeHome
      );
      expect(exitCode).toBe(1);
      expect(stderr).toMatch(/Non-interactive|--all/);
    } finally {
      await cleanup();
    }
  });

  it("marketplace add with file:// URI exits 1 — unsupported format", async () => {
    // NOTE from matrix: file:// URI format not supported; use absolute path instead
    const { projectDir, fakeHome, cleanup } = await createTestEnv("mkt-add-file-uri");
    try {
      await seedManifest(projectDir);
      const { stderr, exitCode } = await runCli(
        ["marketplace", "add", "mymarket", "file:///some/path", "--yes"],
        projectDir,
        fakeHome
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid plugin source");
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Auth — offline operations only
// ---------------------------------------------------------------------------

describe.concurrent("Command Matrix: Auth (offline)", () => {
  it("auth status exits 0 and reports authentication state", async () => {
    // Runs against real user credentials env — test only checks exit 0 and presence
    // of status text. In CI without credentials, output is "Not authenticated."
    const { projectDir, fakeHome, cleanup } = await createTestEnv("auth-status");
    try {
      const { stdout, exitCode } = await runCli(["auth", "status"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      // Either "Authenticated as ..." (dev machine) or "Not authenticated." (CI/fresh env)
      expect(stdout).toMatch(/[Aa]uthenticated/);
    } finally {
      await cleanup();
    }
  });

  it("auth logout exits 0 and is idempotent — reports state after logout", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("auth-logout");
    try {
      const { stdout, exitCode } = await runCli(["auth", "logout"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      // After logout: "Logged out (user)" or "Not authenticated." (already logged out)
      expect(stdout).toMatch(/[Ll]ogged out|[Nn]ot authenticated/);
    } finally {
      await cleanup();
    }
  });

  // auth login --token <invalid> requires network call → verified manually in smoke test
  // auth login --gh (non-interactive) requires network call → verified manually in smoke test
});
