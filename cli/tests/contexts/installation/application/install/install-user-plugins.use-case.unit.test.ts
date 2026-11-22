import { describe, expect, it, vi } from "vitest";
import type { PluginSourceMatch } from "../../../../../src/contexts/distribution/contract/plugin-source-match.js";
import { InstallUserPlugins } from "../../../../../src/contexts/installation/application/install/install-user-plugins.use-case.js";
import type { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { PlannedUserPluginFileUpdate } from "../../../../../src/contexts/installation/ports/plugin/user-plugin-materialization.js";
import type { AiToolProfile } from "../../../../../src/contexts/tools/contract/tool-profile.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../../src/shared/domain/installation-file.js";
import type { ToolId } from "../../../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const HASH = "0".repeat(32);

function match(name: string, recommended = true): PluginSourceMatch {
  return {
    marketplaceName: "aidd-framework",
    githubMarketplace: true,
    entry: {
      name,
      source: { kind: "local", path: `./plugins/${name}` },
      recommended,
      strict: true,
    },
    source: { kind: "git-subdir", url: "https://example.test/fw.git", path: `plugins/${name}` },
  };
}

const DEV = match("aidd-dev");
const PM = match("aidd-pm", false);

function setup(seed: Manifest | null = defaultManifest()) {
  const repo = new InMemoryManifestRepository(seed);
  const planUpdate = vi.fn(
    async ({
      plugin,
      tool,
    }: {
      plugin: RecordedPlugin;
      tool: AiToolProfile;
    }): Promise<PlannedUserPluginFileUpdate> => {
      const relativePath = `agents/${plugin.plugin.name}-reviewer.md`;
      return {
        plugin,
        tool,
        home: "/home",
        baseDir: "/home/.config/opencode",
        files: [new InstallationFile({ relativePath, content: "", hash: new FileHash(HASH) })],
        oldSafe: new Map(),
        next: plugin.withFiles(new Map([[relativePath, HASH]])),
      };
    }
  );
  const applyUpdate = vi.fn(async (plan: PlannedUserPluginFileUpdate) => plan.next);
  const useCase = new InstallUserPlugins(
    { repo, materializer: { planUpdate, applyUpdate }, logger: new CapturingLogger() },
    registeredTools()
  );
  return { repo, useCase, planUpdate, applyUpdate };
}

function defaultManifest(): Manifest {
  const manifest = aManifest().withTool(TOOL.opencode, []).withTool(TOOL.claude, []).build();
  return manifest;
}

function run(
  useCase: InstallUserPlugins,
  plugins: readonly PluginSourceMatch[],
  toolIds: readonly ToolId[] = [TOOL.claude, TOOL.opencode]
) {
  return useCase.execute({ projectRoot: "/project", toolIds, plugins });
}

describe("installing plugins at user scope", () => {
  it("records each plugin's global files for a tool that copies them, under its marketplace", async () => {
    const { repo, useCase, planUpdate } = setup();

    await run(useCase, [DEV, PM]);

    const manifest = repo.getCurrent();
    expect(
      manifest
        ?.getRecordedPlugins(TOOL.opencode)
        .map((p) => [p.plugin.name, p.plugin.scope, p.marketplace, [...p.plugin.files.keys()]])
    ).toEqual([
      ["aidd-dev", "user", "aidd-framework", ["agents/aidd-dev-reviewer.md"]],
      ["aidd-pm", "user", "aidd-framework", ["agents/aidd-pm-reviewer.md"]],
    ]);
    expect(manifest?.getRecordedPlugins(TOOL.claude)).toEqual([]);
    expect(planUpdate).toHaveBeenCalledTimes(2);
  });

  it("plans each plugin from the source its match resolved to", async () => {
    const { useCase, planUpdate } = setup();

    await run(useCase, [DEV], [TOOL.opencode]);

    expect(planUpdate.mock.calls[0][0].plugin.plugin.source).toEqual(DEV.source);
  });

  it("also writes the plugins of a tool installing into a user plugins directory", async () => {
    const seed = defaultManifest();
    seed.addTool(TOOL.cursor, "1.0.0", []);
    const { repo, useCase, planUpdate } = setup(seed);

    await run(useCase, [DEV], [TOOL.cursor]);

    expect(
      repo
        .getCurrent()
        ?.getPlugins(TOOL.cursor)
        .map((p) => [p.name, p.scope])
    ).toEqual([["aidd-dev", "user"]]);
    expect(planUpdate).toHaveBeenCalledWith({
      plugin: expect.objectContaining({ plugin: expect.objectContaining({ name: "aidd-dev" }) }),
      tool: expect.objectContaining({ toolId: TOOL.cursor }),
      projectRoot: "/project",
      logger: expect.anything(),
      rebuild: true,
    });
  });

  it("takes the source this run resolved for a plugin it already owns, and keeps its files", async () => {
    const seed = defaultManifest();
    seed.addPlugin(
      TOOL.opencode,
      RecordedPlugin.fromMetadata({
        name: "aidd-dev",
        version: "1.0.0",
        source: { kind: "local", path: "/moved-away" },
        strict: true,
        scope: "user",
        marketplace: "aidd-framework",
      }).withFiles(new Map([["agents/old.md", HASH]]))
    );
    const { useCase, planUpdate } = setup(seed);

    await run(useCase, [DEV], [TOOL.opencode]);

    const planned = planUpdate.mock.calls[0][0].plugin;
    expect(planned.plugin.source).not.toEqual({ kind: "local", path: "/moved-away" });
    expect([...planned.plugin.files.keys()]).toEqual(["agents/old.md"]);
  });

  it("writes nothing when a later plugin's plan is refused", async () => {
    const { useCase, planUpdate, applyUpdate } = setup();
    const accepted = planUpdate.getMockImplementation();
    if (accepted === undefined) throw new Error("fixture has no plan");
    planUpdate.mockImplementationOnce(accepted);
    planUpdate.mockRejectedValueOnce(new Error("already exists"));

    await expect(run(useCase, [DEV, PM])).rejects.toThrow("already exists");

    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it("has saved the plugins already written when a later write fails", async () => {
    const { repo, useCase, applyUpdate } = setup();
    applyUpdate.mockImplementationOnce(async (plan) => plan.next);
    applyUpdate.mockRejectedValueOnce(new Error("disk full"));

    await expect(run(useCase, [DEV, PM], [TOOL.opencode])).rejects.toThrow("disk full");

    expect(repo.saveCount).toBe(1);
    expect(
      repo
        .getCurrent()
        ?.getRecordedPlugins(TOOL.opencode)
        .map((plugin) => plugin.plugin.name)
    ).toEqual(["aidd-dev"]);
  });

  it("refuses when the machine has no manifest to record into", async () => {
    const { useCase, planUpdate } = setup(null);

    await expect(run(useCase, [DEV])).rejects.toThrow("No machine manifest");

    expect(planUpdate).not.toHaveBeenCalled();
  });
});
