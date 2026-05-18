/**
 * Command Matrix E2E — Help & Globals surface
 * Automated counterpart of: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-command-matrix.md
 *
 * Already covered by existing E2E journeys (not duplicated here):
 *   clean.e2e.test.ts             — clean, clean --force, clean dry-run
 *   update-global.e2e.test.ts     — update, update --force, update multi-tool
 *   sync-plugins.e2e.test.ts      — ai sync variants (missing source, noop, force)
 *   brownfield-migrate.e2e.test.ts — migrate --non-interactive, --dry-run, idempotent
 *
 * See also: command-matrix-ai.e2e.test.ts, command-matrix-plugin.e2e.test.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const AIDD_DIR = ".aidd";
const EMPTY_MANIFEST = { version: 5, tools: {}, marketplaces: {} };

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

// ---------------------------------------------------------------------------
// Help surface
// ---------------------------------------------------------------------------

describe.concurrent("Command Matrix: Help", () => {
  it("aidd --help exits 0 and lists top-level commands", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-root");
    try {
      const { stdout, exitCode } = await runCli(["--help"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("setup");
      expect(stdout).toContain("ai");
      expect(stdout).toContain("ide");
      expect(stdout).toContain("plugin");
      expect(stdout).toContain("marketplace");
      expect(stdout).toContain("auth");
    } finally {
      await cleanup();
    }
  });

  it("aidd ai --help exits 0 and lists ai subcommands", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-ai");
    try {
      const { stdout, exitCode } = await runCli(["ai", "--help"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("install");
      expect(stdout).toContain("uninstall");
      expect(stdout).toContain("list");
    } finally {
      await cleanup();
    }
  });

  it("aidd ide --help exits 0 and lists ide subcommands", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-ide");
    try {
      const { stdout, exitCode } = await runCli(["ide", "--help"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("install");
      expect(stdout).toContain("uninstall");
      expect(stdout).toContain("vscode");
    } finally {
      await cleanup();
    }
  });

  it("aidd plugin --help exits 0 and lists plugin subcommands", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-plugin");
    try {
      const { stdout, exitCode } = await runCli(["plugin", "--help"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("add");
      expect(stdout).toContain("remove");
      expect(stdout).toContain("install");
      expect(stdout).toContain("search");
    } finally {
      await cleanup();
    }
  });

  it("aidd marketplace --help exits 0 and lists marketplace subcommands", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-marketplace");
    try {
      const { stdout, exitCode } = await runCli(["marketplace", "--help"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("add");
      expect(stdout).toContain("list");
      expect(stdout).toContain("remove");
      expect(stdout).toContain("refresh");
      expect(stdout).not.toContain("browse");
    } finally {
      await cleanup();
    }
  });

  it("aidd auth --help exits 0 and lists auth subcommands", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-auth");
    try {
      const { stdout, exitCode } = await runCli(["auth", "--help"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("login");
      expect(stdout).toContain("logout");
      expect(stdout).toContain("status");
    } finally {
      await cleanup();
    }
  });

  it("aidd setup --help shows --source --ai --ide --all and no removed flags", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-setup");
    try {
      const { stdout, exitCode } = await runCli(["setup", "--help"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("--source");
      expect(stdout).toContain("--ai");
      expect(stdout).toContain("--ide");
      expect(stdout).toContain("--all");
      expect(stdout).toContain("--release");
      expect(stdout).not.toContain("--from");
      expect(stdout).not.toContain("--switch-mode");
      expect(stdout).not.toContain("--mode");
      expect(stdout).not.toContain("--repo");
    } finally {
      await cleanup();
    }
  });

  it("aidd install (no --help) exits 1 with unknown command error", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-unknown-install");
    try {
      const { stderr, exitCode } = await runCli(["install"], projectDir, fakeHome);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown command");
      expect(stderr).toContain("install");
    } finally {
      await cleanup();
    }
  });

  it("aidd uninstall exits 1 with unknown command error", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-unknown-uninstall");
    try {
      const { stderr, exitCode } = await runCli(["uninstall"], projectDir, fakeHome);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown command");
    } finally {
      await cleanup();
    }
  });

  it("aidd cache exits 1 with unknown command error", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-unknown-cache");
    try {
      const { stderr, exitCode } = await runCli(["cache"], projectDir, fakeHome);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown command");
    } finally {
      await cleanup();
    }
  });

  it("aidd config exits 1 with unknown command error", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-unknown-config");
    try {
      const { stderr, exitCode } = await runCli(["config"], projectDir, fakeHome);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown command");
    } finally {
      await cleanup();
    }
  });

  it("aidd install --help exits 0 (Commander.js intercepts --help before unknown command check)", async () => {
    // NOTE from matrix: `--help` on unknown command shows top-level help with exit 0.
    // The bare `aidd install` (above) correctly exits 1.
    const { projectDir, fakeHome, cleanup } = await createTestEnv("help-unknown-install-flag");
    try {
      const { stdout, exitCode } = await runCli(["install", "--help"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Usage:");
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Globals — status / doctor / restore / migrate dry-run / self-update --check
// (update and clean are in update-global.e2e.test.ts and clean.e2e.test.ts)
// ---------------------------------------------------------------------------

describe.concurrent("Command Matrix: Globals", () => {
  it("status exits 0 and reports files in sync", async () => {
    // matrix row: "status" → exit 0, "All files are in sync"
    const { projectDir, fakeHome, cleanup } = await createTestEnv("global-status");
    try {
      await seedWithClaude(projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(["status"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/[Aa]ll files are in sync|in sync/);
    } finally {
      await cleanup();
    }
  });

  it("doctor exits 0 and reports installation is healthy", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("global-doctor");
    try {
      await seedWithClaude(projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(["doctor"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("healthy");
    } finally {
      await cleanup();
    }
  });

  it("restore exits 0 reporting nothing to restore when files unmodified", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("global-restore");
    try {
      await seedWithClaude(projectDir, fakeHome);
      const { stdout, exitCode } = await runCli(["restore"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Nothing to restore");
    } finally {
      await cleanup();
    }
  });

  it("migrate --dry-run exits 0 reporting nothing to migrate on empty project", async () => {
    // Uses empty projectDir (no manifest) — "Nothing to migrate."
    const { projectDir, fakeHome, cleanup } = await createTestEnv("global-migrate-dry");
    try {
      const { stdout, exitCode } = await runCli(["migrate", "--dry-run"], projectDir, fakeHome);
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/[Nn]othing to migrate|[Dd]ry-run complete/);
    } finally {
      await cleanup();
    }
  });

  it("sync exits 1 in non-interactive mode with usage hint", async () => {
    // Non-TTY mode (runCli is not a TTY)
    const { projectDir, fakeHome, cleanup } = await createTestEnv("global-sync-noninteractive");
    try {
      await seedWithClaude(projectDir, fakeHome);
      const { stderr, exitCode } = await runCli(["sync"], projectDir, fakeHome);
      expect(exitCode).toBe(1);
      expect(stderr).toMatch(/[Nn]on-interactive|interactive terminal/);
    } finally {
      await cleanup();
    }
  });

  it("self-update --check exits 1 when not authenticated (requires auth)", async () => {
    // NOTE from matrix: self-update requires valid auth; expected in test env.
    // Flag is --check (not --check-only as in task spec — verified against actual CLI).
    const { projectDir, fakeHome, cleanup } = await createTestEnv("global-self-update-check");
    try {
      const { stderr, exitCode } = await runCli(["self-update", "--check"], projectDir, fakeHome);
      expect(exitCode).toBe(1);
      expect(stderr).toMatch(/[Nn]ot authenticated|auth login/);
    } finally {
      await cleanup();
    }
  });
});
