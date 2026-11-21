import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { pluginScriptDir } from "../../../src/contexts/tools/domain/hooks/hooks-merge.js";
import { cursor } from "../../../src/contexts/tools/domain/profiles/cursor/cursor.profile.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../shared/testing/installation-deps.builder.js";
import { present } from "../../shared/testing/present.builder.js";
import { RecordingPrompter } from "../../shared/testing/recording-prompter.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { saying } from "../../shared/testing/saying.builder.js";
import {
  AT_PROJECT,
  CleanWithKnownHostSource,
  md5,
  PROJECT_ROOT,
} from "../testing/clean-project.builder.js";

describe("clean: local files", () => {
  describe("machine-local files a tool's own materialization writes outside the manifest", () => {
    it("removes .claude/settings.local.json, which install writes but the manifest never tracks", async () => {
      const deps = await buildInstallationDeps();
      await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
      const settingsLocalPath = join(PROJECT_ROOT, ".claude", "settings.local.json");
      await deps.fs.writeFile(settingsLocalPath, "{}");

      const useCase = new CleanWithKnownHostSource(
        deps.fs,
        deps.manifestRepo,
        deps.logger,
        deps.updateGitignore
      );
      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(deps.fs.has(settingsLocalPath)).toBe(false);
    });

    it("deletes .cursor/hooks.json entirely once unmerging leaves it empty, and its script directory", async () => {
      const pluginName = "aidd-context";
      const scriptMarker = pluginScriptDir(present(cursor.hooks?.project).scriptsDir, pluginName);
      const command = `./${scriptMarker}run.js`;
      const scriptContent = "// hook script";
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.fromJSON({
          name: pluginName,
          source: { kind: "local", path: "/some/path" },
          version: "1.0.0",
          strict: false,
          files: {},
          scope: "project",
          projectHooks: {
            entries: [{ event: "PreToolUse", command, digest: md5(JSON.stringify({ command })) }],
            scripts: { [`${scriptMarker}run.js`]: md5(scriptContent) },
          },
        })
      );
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const hooksPath = join(PROJECT_ROOT, ".cursor", "hooks.json");
      await fs.writeFile(
        hooksPath,
        JSON.stringify({
          version: 1,
          hooks: { PreToolUse: [{ command }] },
        })
      );
      const scriptPath = join(PROJECT_ROOT, scriptMarker, "run.js");
      await fs.writeFile(scriptPath, scriptContent);
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);

      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new UpdateGitignore(fs)
      );
      await useCase.execute({ ...AT_PROJECT, force: true });

      expect(fs.has(hooksPath)).toBe(false);
      expect(fs.has(scriptPath)).toBe(false);
    });

    it("keeps .cursor/hooks.json when another plugin's entries remain in it", async () => {
      const pluginName = "aidd-context";
      const otherPluginName = "aidd-dev";
      const scriptMarker = pluginScriptDir(present(cursor.hooks?.project).scriptsDir, pluginName);
      const command = `./${scriptMarker}run.js`;
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.fromJSON({
          name: pluginName,
          source: { kind: "local", path: "/some/path" },
          version: "1.0.0",
          strict: false,
          files: {},
          scope: "project",
          projectHooks: {
            entries: [{ event: "PreToolUse", command, digest: md5(JSON.stringify({ command })) }],
            scripts: {},
          },
        })
      );
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const hooksPath = join(PROJECT_ROOT, ".cursor", "hooks.json");
      const otherScriptMarker = pluginScriptDir(
        present(cursor.hooks?.project).scriptsDir,
        otherPluginName
      );
      await fs.writeFile(
        hooksPath,
        JSON.stringify({
          version: 1,
          hooks: {
            PreToolUse: [{ command }, { command: `./${otherScriptMarker}run.js` }],
          },
        })
      );
      const otherScriptPath = join(PROJECT_ROOT, otherScriptMarker, "run.js");
      await fs.writeFile(
        otherScriptPath,
        "// hook script belonging to a plugin clean never tracked"
      );
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);

      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new UpdateGitignore(fs)
      );
      await useCase.execute({ ...AT_PROJECT, force: true });

      const remainingHooks = fs.getFile(hooksPath);
      expect(remainingHooks).toBeDefined();
      expect(remainingHooks).not.toContain(scriptMarker);
      expect(remainingHooks).toContain(otherScriptMarker);
      expect(fs.has(otherScriptPath)).toBe(true);
    });

    it("rejects an edited Cursor hook on a confirmed clean without --force, before dropping a shared source reference or touching native state", async () => {
      const pluginName = "aidd-context";
      const scriptMarker = pluginScriptDir(present(cursor.hooks?.project).scriptsDir, pluginName);
      const command = `./${scriptMarker}run.js`;
      const scriptPath = join(PROJECT_ROOT, scriptMarker, "run.js");
      const installedScript = "// installed hook";
      const editedScript = "// edited by the user";
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(
        TOOL.cursor,
        InstalledPlugin.fromJSON({
          name: pluginName,
          source: { kind: "local", path: "/some/path" },
          version: "1.0.0",
          strict: false,
          files: {},
          scope: "project",
          projectHooks: {
            entries: [{ event: "PreToolUse", command, digest: md5(JSON.stringify({ command })) }],
            scripts: { [`${scriptMarker}run.js`]: md5(installedScript) },
          },
        })
      );
      manifest.addTool(TOOL.codex, "1.0.0", []);
      manifest.setNativeRegistrations(TOOL.codex, {
        binary: "codex",
        marketplaces: [
          {
            alias: "aidd-framework",
            hostName: "aidd-framework",
            provenance: {
              kind: "effective-list",
              root: "/some/built/path",
              sourceType: "local",
              source: "/some/built/path",
            },
          },
          {
            alias: "project-native",
            hostName: "other-host",
            provenance: {
              kind: "effective-list",
              root: "/some/built/path",
              sourceType: "local",
              source: "/some/built/path",
            },
          },
        ],
        pluginRefs: ["aidd-context@aidd-framework"],
      });
      const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
      const hooksPath = join(PROJECT_ROOT, ".cursor", "hooks.json");
      await fs.writeFile(
        hooksPath,
        JSON.stringify({ version: 1, hooks: { PreToolUse: [{ command }] } })
      );
      await fs.writeFile(scriptPath, editedScript);
      const cachePath = join(PROJECT_ROOT, ".aidd", "cache", "built.json");
      const gitignorePath = join(PROJECT_ROOT, ".gitignore");
      fs.setFile(cachePath, "built source");
      fs.setFile(gitignorePath, ".aidd/cache/\n");
      fs.setFile(join(PROJECT_ROOT, "marker"), "");
      fs.setFile("/other-project/marker", "");
      const references = new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
      await references.addReference("1.0.0", PROJECT_ROOT);
      await references.addReference("1.0.0", "/other-project");
      const registry = new InMemoryMarketplaceRegistry();
      for (const [name, scope] of [
        ["aidd-framework", "user"],
        ["project-native", "project"],
      ] as const) {
        await registry.save(
          PROJECT_ROOT,
          Marketplace.create({
            name,
            source: { kind: "local", path: "/some/built/path" },
            scope,
            addedAt: "2026-01-01T00:00:00.000Z",
          })
        );
      }
      const manifestRepo = new InMemoryManifestRepository(manifest, PROJECT_ROOT);
      const activator = new FakeHostActions({ available: true });
      const useCase = new CleanWithKnownHostSource(
        fs,
        manifestRepo,
        new CapturingLogger(),
        new UpdateGitignore(fs),
        new Map([[TOOL.codex, activator]]),
        registry,
        new RecordingPrompter(true),
        new Map(),
        () => "/fake-home",
        references,
        undefined,
        new InMemoryManifestRepository(Manifest.create(), "/fake-home")
      );

      await expect(
        useCase.execute({ ...AT_PROJECT, force: false, interactive: true })
      ).rejects.toThrow(saying("edited after install"));

      expect(await references.listAllReferencingProjects()).toContain(PROJECT_ROOT);
      expect(await references.listAllReferencingProjects()).toContain("/other-project");
      expect(activator.uninstalledPlugins).toEqual([]);
      expect(activator.removedMarketplaces).toEqual([]);
      expect(fs.getFile(scriptPath)).toBe(editedScript);
      expect(fs.getFile(cachePath)).toBe("built source");
      expect(fs.getFile(gitignorePath)).toBe(".aidd/cache/\n");
      expect(manifestRepo.getCurrent()).toBe(manifest);
      expect(fs.has(hooksPath)).toBe(true);
      expect(fs.has(join(PROJECT_ROOT, "marker"))).toBe(true);
    });
  });

  it("rejects an edited OpenCode MCP entry before dropping the shared source reference", async () => {
    const originalServer = { type: "local" };
    const editedConfig = JSON.stringify({ mcp: { mine: { type: "remote" } } });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.opencode, "1.0.0", []);
    manifest.addPlugin(
      TOOL.opencode,
      InstalledPlugin.fromJSON({
        name: "aidd-context",
        source: { kind: "local", path: "/some/path" },
        version: "1.0.0",
        strict: false,
        files: {},
        mcpEntries: { mine: md5(JSON.stringify(originalServer)) },
        scope: "project",
      })
    );
    manifest.addTool(TOOL.codex, "1.0.0", []);
    manifest.setNativeRegistrations(TOOL.codex, {
      binary: "codex",
      marketplaces: [
        {
          alias: "aidd-framework",
          hostName: "aidd-framework",
          provenance: {
            kind: "effective-list",
            root: "/some/built/path",
            sourceType: "local",
            source: "/some/built/path",
          },
        },
      ],
      pluginRefs: ["aidd-context@aidd-framework"],
    });
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const configPath = join(PROJECT_ROOT, "opencode.json");
    await fs.writeFile(configPath, editedConfig);
    fs.setFile(join(PROJECT_ROOT, "marker"), "");
    fs.setFile("/other-project/marker", "");
    const references = new UserSourceReferencesAdapter(fs, () => "/fake-home/.config/aidd");
    await references.addReference("1.0.0", PROJECT_ROOT);
    await references.addReference("1.0.0", "/other-project");
    const activator = new FakeHostActions({ available: true });
    const useCase = new CleanWithKnownHostSource(
      fs,
      new InMemoryManifestRepository(manifest, PROJECT_ROOT),
      new CapturingLogger(),
      new UpdateGitignore(fs),
      new Map([[TOOL.codex, activator]]),
      undefined,
      undefined,
      new Map(),
      () => "/fake-home",
      references
    );

    await expect(useCase.execute({ ...AT_PROJECT, force: true })).rejects.toThrow("edited");

    expect(await references.listAllReferencingProjects()).toContain(PROJECT_ROOT);
    expect(await references.listAllReferencingProjects()).toContain("/other-project");
    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.getFile(configPath)).toBe(editedConfig);
  });
});
