import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
import { aManifest } from "../../../contexts/installation/testing/manifest.builder.js";
import { removalClaimsOf } from "../../../contexts/machine-claims/testing/claims-release.builder.js";
import { dependentsRecorded } from "../../../shared/testing/host-record-reading.builder.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";
import { removeProjectPluginOf } from "../../../shared/testing/remove-project-plugin.builder.js";
import { KeepPrompter } from "../../../shared/testing/scripted-prompter.fake.js";
import {
  SYNTHETIC_MCP_FILE,
  SYNTHETIC_MCP_TOOL,
  SYNTHETIC_USER_TOOL,
  syntheticNativeFamilyCatalog,
} from "../../../shared/testing/synthetic-native-tool.builder.js";
import {
  buildUseCase,
  marketplaceNamed,
  PROJECT_ROOT,
} from "../../testing/project-marketplace-removal.builder.js";
import { projectMarketplaceRemover } from "../../testing/project-marketplace-remover.builder.js";

const HOOKS_FILE = `.${SYNTHETIC_USER_TOOL}/hooks.json`;

describe("which plugins a removal orphans: what it protects", () => {
  it("keeps A and B hook claims when project hooks.json resolves outside the project", async () => {
    const hooksPath = join(PROJECT_ROOT, HOOKS_FILE);
    const foreignPath = "/foreign/hooks.json";
    const command = `node ./.${SYNTHETIC_USER_TOOL}/hooks/sample/pre.js`;
    const entry = { command };
    const content = JSON.stringify({ version: 1, hooks: { preToolUse: [entry] } });
    const fs = new InMemoryFileAdapter({ [hooksPath]: content, [foreignPath]: content }, [
      PROJECT_ROOT,
    ]);
    fs.setSymlink(hooksPath, foreignPath);
    const plugin = RecordedPlugin.fromJSON({
      name: "sample",
      source: { kind: "local", path: "/fixture" },
      version: "1.0.0",
      strict: false,
      files: {},
      scope: "user",
      marketplace: "awesome",
      projectHooks: {
        entries: [
          {
            event: "preToolUse",
            command,
            digest: FileHash.of(JSON.stringify(entry)).value,
          },
        ],
        scripts: {},
      },
    });
    const project = aManifest()
      .withTool(SYNTHETIC_USER_TOOL, [])
      .withPlugin(SYNTHETIC_USER_TOOL, plugin)
      .build();
    const projectRepo = new InMemoryManifestRepository(project);
    const machine = aManifest()
      .withTool(SYNTHETIC_USER_TOOL, [])
      .withPlugin(SYNTHETIC_USER_TOOL, plugin)
      .build();
    const machineRepo = new InMemoryManifestRepository(
      machine,
      undefined,
      new Map([
        [
          SYNTHETIC_USER_TOOL,
          { pluginClaims: [{ plugin: "sample", dependents: [PROJECT_ROOT, "/B"] }] },
        ],
      ])
    );
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));
    const useCase = projectMarketplaceRemover(
      syntheticNativeFamilyCatalog(),
      removeProjectPluginOf(fs, removalClaimsOf(machineRepo, fs)),
      projectRepo,
      registry,
      new KeepPrompter()
    );

    await expect(
      useCase.execute({
        name: "awesome",
        projectRoot: PROJECT_ROOT,
        autoConfirm: true,
      })
    ).rejects.toThrow(/outside.*project/);

    expect(projectRepo.getCurrent()?.getRecordedPlugins(SYNTHETIC_USER_TOOL)).toHaveLength(1);
    expect(dependentsRecorded(machineRepo.records.get(SYNTHETIC_USER_TOOL), "sample")).toEqual([
      PROJECT_ROOT,
      "/B",
    ]);
    expect(fs.getFile(foreignPath)).toBe(content);
    expect((await registry.list(PROJECT_ROOT)).some((entry) => entry.name === "awesome")).toBe(
      true
    );
  });

  it("retains the MCP orphan and catalogue when MCP output is a symlink outside the project", async () => {
    const mcpPath = join(PROJECT_ROOT, SYNTHETIC_MCP_FILE);
    const foreignPath = `/foreign/${SYNTHETIC_MCP_FILE}`;
    const content = JSON.stringify({
      mcp: { mine: { type: "local" }, theirs: { type: "remote" } },
    });
    const fs = new InMemoryFileAdapter({ [mcpPath]: content, [foreignPath]: content }, [
      PROJECT_ROOT,
    ]);
    fs.setSymlink(mcpPath, foreignPath);
    const manifest = aManifest()
      .withTool(SYNTHETIC_MCP_TOOL, [])
      .withPlugin(
        SYNTHETIC_MCP_TOOL,
        RecordedPlugin.fromJSON({
          name: "sample",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: {},
          mcpEntries: {
            mine: FileHash.of(JSON.stringify({ type: "local" })).value,
          },
          scope: "project",
          marketplace: "awesome",
        })
      )
      .build();
    const manifestRepo = new InMemoryManifestRepository(manifest);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));
    const useCase = projectMarketplaceRemover(
      syntheticNativeFamilyCatalog(),
      removeProjectPluginOf(fs),
      manifestRepo,
      registry,
      new KeepPrompter()
    );

    await expect(
      useCase.execute({
        name: "awesome",
        projectRoot: PROJECT_ROOT,
        autoConfirm: true,
      })
    ).rejects.toThrow(/outside.*project|escapes.*project/);

    expect(manifestRepo.saveCount).toBe(0);
    expect(manifestRepo.getCurrent()?.getRecordedPlugins(SYNTHETIC_MCP_TOOL)).toHaveLength(1);
    expect(fs.getFile(foreignPath)).toBe(content);
    expect(fs.getFile(mcpPath)).toBe(content);
    expect((await registry.list(PROJECT_ROOT)).some((entry) => entry.name === "awesome")).toBe(
      true
    );
  });

  it("retains the MCP orphan and catalogue when its project MCP config cannot be rewritten", async () => {
    const mcpPath = join(PROJECT_ROOT, SYNTHETIC_MCP_FILE);
    const content = JSON.stringify({
      mcp: { mine: { type: "local" }, theirs: { type: "remote" } },
    });
    class RefusingMcpWriteAdapter extends InMemoryFileAdapter {
      override async writeFile(path: string, value: string): Promise<void> {
        if (path === mcpPath) throw new Error("MCP write refused");
        return super.writeFile(path, value);
      }
    }
    const fs = new RefusingMcpWriteAdapter({ [mcpPath]: content });
    const manifest = aManifest()
      .withTool(SYNTHETIC_MCP_TOOL, [])
      .withPlugin(
        SYNTHETIC_MCP_TOOL,
        RecordedPlugin.fromJSON({
          name: "sample",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: {},
          mcpEntries: {
            mine: FileHash.of(JSON.stringify({ type: "local" })).value,
          },
          scope: "project",
          marketplace: "awesome",
        })
      )
      .build();
    const manifestRepo = new InMemoryManifestRepository(manifest);
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));
    const useCase = projectMarketplaceRemover(
      syntheticNativeFamilyCatalog(),
      removeProjectPluginOf(fs),
      manifestRepo,
      registry,
      new KeepPrompter()
    );

    await expect(
      useCase.execute({
        name: "awesome",
        projectRoot: PROJECT_ROOT,
        autoConfirm: true,
      })
    ).rejects.toThrow(/MCP write refused/);

    expect(manifestRepo.saveCount).toBe(0);
    expect(manifestRepo.getCurrent()?.getRecordedPlugins(SYNTHETIC_MCP_TOOL)).toHaveLength(1);
    expect(fs.getFile(mcpPath)).toBe(content);
    expect((await registry.list(PROJECT_ROOT)).some((entry) => entry.name === "awesome")).toBe(
      true
    );
  });

  it("unmerges only the orphan's contributed MCP server from the project", async () => {
    const { useCase, registry, manifestRepo, fs } = buildUseCase(syntheticNativeFamilyCatalog());
    const manifest = aManifest()
      .withTool(SYNTHETIC_MCP_TOOL, [])
      .withPlugin(
        SYNTHETIC_MCP_TOOL,
        RecordedPlugin.fromJSON({
          name: "sample",
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: {},
          mcpEntries: {
            mine: FileHash.of(JSON.stringify({ type: "local" })).value,
          },
          scope: "project",
          marketplace: "awesome",
        })
      )
      .build();
    await manifestRepo.save(manifest);
    const mcpPath = join(PROJECT_ROOT, SYNTHETIC_MCP_FILE);
    fs.setFile(
      mcpPath,
      JSON.stringify({ mcp: { mine: { type: "local" }, theirs: { type: "remote" } } })
    );
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));

    fs.setFile(
      mcpPath,
      JSON.stringify({ mcp: { mine: { type: "user-edited" }, theirs: { type: "remote" } } })
    );
    await expect(
      useCase.execute({
        name: "awesome",
        projectRoot: PROJECT_ROOT,
        autoConfirm: true,
      })
    ).rejects.toThrow(/edited/);
    expect((await manifestRepo.load())?.getRecordedPlugins(SYNTHETIC_MCP_TOOL)).toHaveLength(1);
    expect((await registry.list(PROJECT_ROOT)).some((entry) => entry.name === "awesome")).toBe(
      true
    );
    fs.setFile(
      mcpPath,
      JSON.stringify({ mcp: { mine: { type: "local" }, theirs: { type: "remote" } } })
    );

    await useCase.execute({
      name: "awesome",
      projectRoot: PROJECT_ROOT,
      autoConfirm: true,
    });

    expect(JSON.parse(fs.getFile(mcpPath) ?? "null")).toEqual({
      mcp: { theirs: { type: "remote" } },
    });
    expect((await manifestRepo.load())?.getRecordedPlugins(SYNTHETIC_MCP_TOOL)).toEqual([]);
  });

  it("preflights every orphan before touching A when B's MCP contribution was edited", async () => {
    const { useCase, registry, manifestRepo, fs } = buildUseCase(syntheticNativeFamilyCatalog());
    const manifest = Manifest.create();
    manifest.addTool(SYNTHETIC_MCP_TOOL, "1.0.0", []);
    for (const name of ["alpha", "beta"]) {
      manifest.addPlugin(
        SYNTHETIC_MCP_TOOL,
        RecordedPlugin.fromJSON({
          name,
          source: { kind: "local", path: "/fixture" },
          version: "1.0.0",
          strict: false,
          files: {},
          mcpEntries: {
            [name]: FileHash.of(JSON.stringify({ type: "local" })).value,
          },
          scope: "project",
          marketplace: "awesome",
        })
      );
    }
    await manifestRepo.save(manifest);
    await registry.save(PROJECT_ROOT, marketplaceNamed("awesome"));
    const path = join(PROJECT_ROOT, SYNTHETIC_MCP_FILE);
    const edited = JSON.stringify({
      mcp: { alpha: { type: "local" }, beta: { type: "user-edited" } },
    });
    fs.setFile(path, edited);
    await expect(
      useCase.execute({
        name: "awesome",
        projectRoot: PROJECT_ROOT,
        autoConfirm: true,
      })
    ).rejects.toThrow(/edited.*beta|beta.*edited/);
    expect(fs.getFile(path)).toBe(edited);
    expect(
      (await manifestRepo.load())?.getRecordedPlugins(SYNTHETIC_MCP_TOOL).map((p) => p.plugin.name)
    ).toEqual(["alpha", "beta"]);
    expect((await registry.list(PROJECT_ROOT)).some((m) => m.name === "awesome")).toBe(true);
  });
});
