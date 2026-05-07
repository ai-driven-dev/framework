/**
 * Network E2E tests — gated behind RUN_NETWORK_TESTS=1.
 *
 * These tests exercise the real GitHub fetch path against
 * https://github.com/ai-driven-dev/aidd-framework.git.
 *
 * Why it.skipIf (NOT .skip):
 *   Unconditional .skip would permanently exclude these tests even in CI.
 *   it.skipIf skips only when the env var is absent, so the nightly workflow
 *   can activate them without touching the test file.
 *
 * Note on plugin search/install tests:
 *   The real aidd-framework GitHub repo does not include a .claude-plugin/marketplace.json.
 *   Tests 3 and 4 assert that the CLI handles this gracefully (no crash, exit 0).
 *   Once the framework repo ships a plugin catalog, update assertions to check plugin names.
 *
 * Run locally:
 *   RUN_NETWORK_TESTS=1 pnpm test:e2e tests/e2e/network.e2e.test.ts
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const RUN_NETWORK = process.env.RUN_NETWORK_TESTS === "1";

const MARKETPLACE_NAME = "aidd-framework";
const AIDD_DIR = ".aidd";

describe.concurrent("Network E2E — real GitHub fetch path", () => {
  it.skipIf(!RUN_NETWORK)(
    "aidd setup --source remote --ai claude --no-plugins --yes installs claude and writes v5 manifest",
    async () => {
      const { projectDir, fakeHome, cleanup } = await createTestEnv("net-setup-claude");
      try {
        const { stdout, exitCode } = await runCli(
          ["setup", "--source", "remote", "--ai", "claude", "--no-plugins", "--yes"],
          projectDir,
          fakeHome
        );

        expect(exitCode).toBe(0);
        expect(stdout).toContain("claude");

        const raw = await readFile(join(projectDir, AIDD_DIR, "manifest.json"), "utf-8");
        const manifest = JSON.parse(raw) as Record<string, unknown>;

        expect(manifest.version).toBe(5);
        expect(manifest).toHaveProperty("tools");
        expect(manifest).toHaveProperty("marketplaces");

        const tools = manifest.tools as Record<string, unknown>;
        expect(tools).toHaveProperty("claude");

        expect(existsSync(join(projectDir, ".claude", "settings.json"))).toBe(true);
      } finally {
        await cleanup();
      }
    },
    { retry: 2 }
  );

  it.skipIf(!RUN_NETWORK)(
    "aidd marketplace refresh aidd-framework fetches real catalog and populates cache",
    async () => {
      const { projectDir, fakeHome, cleanup } = await createTestEnv("net-mkt-refresh");
      try {
        await runCli(
          ["setup", "--source", "remote", "--ai", "claude", "--no-plugins", "--yes"],
          projectDir,
          fakeHome
        );

        const { stdout, exitCode } = await runCli(
          ["marketplace", "refresh", MARKETPLACE_NAME],
          projectDir,
          fakeHome
        );

        expect(exitCode).toBe(0);
        expect(stdout).toContain(MARKETPLACE_NAME);

        const cacheList = await runCli(["marketplace", "cache", "list"], projectDir, fakeHome);
        expect(cacheList.exitCode).toBe(0);
        expect(cacheList.stdout).toContain(MARKETPLACE_NAME);
      } finally {
        await cleanup();
      }
    },
    { retry: 2 }
  );

  it.skipIf(!RUN_NETWORK)(
    "aidd plugin search --marketplace aidd-framework exits 0 after real catalog refresh",
    async () => {
      const { projectDir, fakeHome, cleanup } = await createTestEnv("net-plugin-search");
      try {
        await runCli(
          ["setup", "--source", "remote", "--ai", "claude", "--no-plugins", "--yes"],
          projectDir,
          fakeHome
        );
        await runCli(["marketplace", "refresh", MARKETPLACE_NAME], projectDir, fakeHome);

        const { exitCode } = await runCli(
          ["plugin", "search", "aidd-context", "--marketplace", MARKETPLACE_NAME],
          projectDir,
          fakeHome
        );

        // Exit 0 even when the real repo has no .claude-plugin/marketplace.json yet —
        // confirms the search path handles a catalog-less marketplace without crashing.
        expect(exitCode).toBe(0);
      } finally {
        await cleanup();
      }
    },
    { retry: 2 }
  );

  it.skipIf(!RUN_NETWORK)(
    "aidd plugin install from real aidd-framework exits non-zero with a descriptive error when catalog absent",
    async () => {
      const { projectDir, fakeHome, cleanup } = await createTestEnv("net-plugin-install");
      try {
        await runCli(
          ["setup", "--source", "remote", "--ai", "claude", "--no-plugins", "--yes"],
          projectDir,
          fakeHome
        );
        await runCli(["marketplace", "refresh", MARKETPLACE_NAME], projectDir, fakeHome);

        const { stderr, exitCode } = await runCli(
          ["plugin", "install", "aidd-context", "--tool", "claude"],
          projectDir,
          fakeHome
        );

        // The real aidd-framework repo has no .claude-plugin/marketplace.json yet.
        // Assert the CLI fails with a descriptive error (no panic, no stack trace).
        // Update this test to expect exitCode 0 once the framework ships a plugin catalog.
        expect(exitCode).toBe(1);
        expect(stderr).toMatch(/not found|marketplace\.json|catalog/i);
      } finally {
        await cleanup();
      }
    },
    { retry: 2 }
  );
});
