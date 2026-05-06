import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "../../../src/domain/tools/ai/claude.js";
import "../../../src/domain/tools/ai/codex.js";
import "../../../src/domain/tools/ai/copilot.js";
import "../../../src/domain/tools/ai/cursor.js";
import "../../../src/domain/tools/ai/opencode.js";
import "../../../src/domain/tools/ide/vscode.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MigrateBackupUseCase } from "../../../src/application/use-cases/migrate/migrate-backup-use-case.js";
import { MigrateRewirePluginsUseCase } from "../../../src/application/use-cases/migrate/migrate-rewire-plugins-use-case.js";
import { MigrateStripDeadFilesUseCase } from "../../../src/application/use-cases/migrate/migrate-strip-dead-files-use-case.js";
import { MigrateUseCase } from "../../../src/application/use-cases/migrate-use-case.js";
import { AIDD_DIR } from "../../../src/domain/models/paths.js";
import { buildDeps, KeepPrompter } from "./helpers.js";

const noOpRegister = { execute: async () => ({ registered: false }) };
const noOpPluginInstall = {
  execute: async () => ({ marketplace: {} as never, entry: {} as never }),
};

const BASE_MANIFEST = {
  version: 5,
  docsDir: "aidd_docs",
  tools: {},
  scripts: null,
  plugins: null,
  mode: "local",
};

describe("MigrateUseCase", () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-migrate-int-"));
    projectRoot = join(tempDir, "project");
    await mkdir(join(projectRoot, AIDD_DIR), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function seedManifest(data: unknown): Promise<void> {
    await writeFile(join(projectRoot, AIDD_DIR, "manifest.json"), JSON.stringify(data), "utf-8");
  }

  function buildUseCase(deps: ReturnType<typeof buildDeps>) {
    const migrateBackup = new MigrateBackupUseCase(deps.fs);
    const migrateStripDeadFiles = new MigrateStripDeadFilesUseCase(deps.fs, deps.logger);
    const migrateRewirePlugins = new MigrateRewirePluginsUseCase(
      noOpPluginInstall as never,
      deps.logger
    );
    return new MigrateUseCase(
      deps.fs,
      deps.manifestRepo,
      deps.logger,
      new KeepPrompter(),
      noOpRegister as never,
      migrateBackup,
      migrateStripDeadFiles,
      migrateRewirePlugins
    );
  }

  describe("no-op cases", () => {
    it("returns no-op when no manifest exists", async () => {
      const deps = buildDeps(projectRoot);
      const result = await buildUseCase(deps).execute({
        projectRoot,
        interactive: false,
        dryRun: false,
      });
      expect(result.kind).toBe("no-op");
    });

    it("returns no-op when manifest has nothing to migrate", async () => {
      await seedManifest(BASE_MANIFEST);
      const deps = buildDeps(projectRoot);
      const result = await buildUseCase(deps).execute({
        projectRoot,
        interactive: false,
        dryRun: false,
      });
      expect(result.kind).toBe("no-op");
    });
  });

  describe("dry-run", () => {
    it("returns dry-run without modifying manifest", async () => {
      await seedManifest({
        ...BASE_MANIFEST,
        scripts: {
          version: "1.0.0",
          files: [{ relativePath: "scripts/build.sh", hash: "a".repeat(32) }],
        },
      });
      const deps = buildDeps(projectRoot);
      const result = await buildUseCase(deps).execute({
        projectRoot,
        interactive: false,
        dryRun: true,
      });
      expect(result.kind).toBe("dry-run");
      const saved = await deps.manifestRepo.load();
      expect(saved?.hasScripts()).toBe(true);
    });
  });

  describe("scripts section", () => {
    it("clears obsolete scripts section", async () => {
      await seedManifest({
        ...BASE_MANIFEST,
        scripts: {
          version: "1.0.0",
          files: [{ relativePath: "scripts/build.sh", hash: "a".repeat(32) }],
        },
      });
      const deps = buildDeps(projectRoot);
      await buildUseCase(deps).execute({ projectRoot, interactive: false, dryRun: false });
      const saved = await deps.manifestRepo.load();
      expect(saved?.hasScripts()).toBe(false);
    });
  });

  describe("plugins section", () => {
    it("clears obsolete top-level plugins section", async () => {
      await seedManifest({
        ...BASE_MANIFEST,
        plugins: { version: "1.0.0", files: [] },
      });
      const deps = buildDeps(projectRoot);
      await buildUseCase(deps).execute({ projectRoot, interactive: false, dryRun: false });
      const saved = await deps.manifestRepo.load();
      expect(saved?.hasPlugins()).toBe(false);
    });
  });

  describe("bundled plugins", () => {
    it("removes bundled plugin entries from tool", async () => {
      await seedManifest({
        ...BASE_MANIFEST,
        tools: {
          claude: {
            toolId: "claude",
            version: "1.0.0",
            files: [],
            plugins: [
              {
                name: "aidd-context",
                source: { kind: "local", path: "plugins/aidd-context" },
                version: "1.0.0",
                strict: false,
                files: {},
              },
            ],
          },
        },
      });
      const deps = buildDeps(projectRoot);
      await buildUseCase(deps).execute({ projectRoot, interactive: false, dryRun: false });
      const saved = await deps.manifestRepo.load();
      expect(saved?.getPlugins("claude").length).toBe(0);
    });

    it("preserves marketplace-linked plugins", async () => {
      await seedManifest({
        ...BASE_MANIFEST,
        tools: {
          claude: {
            toolId: "claude",
            version: "1.0.0",
            files: [],
            plugins: [
              {
                name: "aidd-context",
                source: { kind: "local", path: "plugins/aidd-context" },
                version: "1.0.0",
                strict: false,
                files: {},
                marketplace: "aidd-framework",
              },
            ],
          },
        },
      });
      const deps = buildDeps(projectRoot);
      const result = await buildUseCase(deps).execute({
        projectRoot,
        interactive: false,
        dryRun: false,
      });
      expect(result.kind).toBe("no-op");
      const saved = await deps.manifestRepo.load();
      expect(saved?.getPlugins("claude").length).toBe(1);
    });

    it("continues when plugin rewire fails (best-effort)", async () => {
      const failingPluginInstall = {
        execute: async () => {
          throw new Error("marketplace unavailable");
        },
      };
      await seedManifest({
        ...BASE_MANIFEST,
        tools: {
          claude: {
            toolId: "claude",
            version: "1.0.0",
            files: [],
            plugins: [
              {
                name: "aidd-context",
                source: { kind: "local", path: "plugins/aidd-context" },
                version: "1.0.0",
                strict: false,
                files: {},
              },
            ],
          },
        },
      });
      const deps = buildDeps(projectRoot);
      const migrateBackup = new MigrateBackupUseCase(deps.fs);
      const migrateStripDeadFiles = new MigrateStripDeadFilesUseCase(deps.fs, deps.logger);
      const migrateRewirePlugins = new MigrateRewirePluginsUseCase(
        failingPluginInstall as never,
        deps.logger
      );
      const uc = new MigrateUseCase(
        deps.fs,
        deps.manifestRepo,
        deps.logger,
        new KeepPrompter(),
        noOpRegister as never,
        migrateBackup,
        migrateStripDeadFiles,
        migrateRewirePlugins
      );
      const result = await uc.execute({ projectRoot, interactive: false, dryRun: false });
      expect(result.kind).toBe("migrated");
    });

    it("creates backup manifest before writing", async () => {
      await seedManifest({
        ...BASE_MANIFEST,
        scripts: { version: "1.0.0", files: [] },
      });
      const deps = buildDeps(projectRoot);
      await buildUseCase(deps).execute({ projectRoot, interactive: false, dryRun: false });
      const files = await deps.fs.listDirectory(join(projectRoot, AIDD_DIR));
      expect(files.some((f) => f.includes("manifest.json.bak."))).toBe(true);
    });
  });
});
