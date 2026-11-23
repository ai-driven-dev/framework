import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { remoteFrameworkSource } from "../../../src/contexts/distribution/contract/framework-source.js";
import { ProjectContext } from "../../../src/contexts/installation/contract/project-context.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { SetupFlow } from "../../../src/orchestration/domain/setup-flow.model.js";
import { UserScopeUnavailableError } from "../../../src/orchestration/orchestration.error.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
  syntheticFlowTools,
  syntheticMixedCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  makeRecordingUserSourceReferences,
  PROJECT_ROOT,
  runSetupScenarioOf,
} from "../testing/run-setup-scenario.builder.js";

const { buildUseCase, remoteFlow } = runSetupScenarioOf(syntheticMixedCatalog());

describe("setup interactive tool selection", () => {
  function _interactiveFlow(
    opts: Partial<{ aiTools: ToolId[]; ideTools: ToolId[] }> = {}
  ): SetupFlow {
    return new SetupFlow({
      ...syntheticFlowTools(),
      supportsUserScopeActivation: () => true,
      projectRoot: PROJECT_ROOT,
      source: remoteFrameworkSource(),
      aiTools: opts.aiTools ?? [],
      ideTools: opts.ideTools ?? [],
      pluginMode: "none",
      interactive: true,
    });
  }

  it("hands the tools question the flow's whole request, and installs the answer", async () => {
    const answer = vi.fn(async () => ({ aiTools: [SECOND_SYNTHETIC_TOOL], ideTools: [] }));
    const { useCase, deps } = await buildUseCase({ execute: answer }, undefined, undefined, {
      detectContext: true,
    });
    deps.fs.setFile(join(PROJECT_ROOT, "tsconfig.json"), "{}");

    const result = await useCase.execute(
      remoteFlow({
        aiTools: [SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL],
        ideTools: [SYNTHETIC_IDE_TOOL],
      })
    );

    expect(answer).toHaveBeenCalledWith({
      interactive: false,
      aiTools: [SYNTHETIC_TOOL, SECOND_SYNTHETIC_TOOL],
      ideTools: [SYNTHETIC_IDE_TOOL],
      context: new ProjectContext({ stack: "typescript", isMonorepo: false, hasFramework: false }),
    });
    if (result.kind === "initialized") {
      expect(result.install.results.map((r) => r.toolId)).toEqual([SECOND_SYNTHETIC_TOOL]);
    }
  });

  it("non-interactive + empty tools → no prompt, installs nothing", async () => {
    const { useCase } = await buildUseCase();

    const result = await useCase.execute(remoteFlow());

    expect(result.kind).toBe("initialized");
    if (result.kind === "initialized") {
      expect(result.install.results).toHaveLength(0);
    }
  });
});

describe("setup --scope user", () => {
  it("refuses when no machine-scope use case was wired", async () => {
    const { useCase } = await buildUseCase();

    await expect(
      useCase.execute(remoteFlow({ aiTools: [SYNTHETIC_TOOL], scope: "user" }))
    ).rejects.toThrow(UserScopeUnavailableError);
  });

  it("reports a first run as initialized, installing nothing", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    const result = await useCase.execute(remoteFlow({ aiTools: [SYNTHETIC_TOOL], scope: "user" }));

    expect(result).toStrictEqual({
      kind: "initialized",
      install: { results: [] },
      activation: { updatedTools: [] },
      context: undefined,
      globalPlugins: [],
    });
  });

  it("reports a repeat run as up-to-date", async () => {
    const userManifestRepo = new InMemoryManifestRepository(Manifest.create());
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    const result = await useCase.execute(remoteFlow({ aiTools: [SYNTHETIC_TOOL], scope: "user" }));

    expect(result).toStrictEqual({
      kind: "up-to-date",
      install: { results: [] },
      activation: { updatedTools: [] },
      context: undefined,
      globalPlugins: [],
    });
  });

  it("keeps the tools an earlier run registered", async () => {
    const seed = Manifest.create();
    seed.addTool(SECOND_SYNTHETIC_TOOL, "9.9.9", []);
    const userManifestRepo = new InMemoryManifestRepository(seed);
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    await useCase.execute(remoteFlow({ aiTools: [SYNTHETIC_TOOL], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getInstalledToolIds()).toStrictEqual([
      SECOND_SYNTHETIC_TOOL,
      SYNTHETIC_TOOL,
    ]);
  });

  it("registers a new tool with no files and saves the manifest once", async () => {
    const userManifestRepo = new InMemoryManifestRepository(Manifest.create());
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    await useCase.execute(remoteFlow({ aiTools: [SYNTHETIC_TOOL], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getToolFiles(SYNTHETIC_TOOL)).toStrictEqual([]);
    expect(userManifestRepo.saveCount).toBe(1);
  });

  it("leaves an already-registered tool at its recorded version, saving nothing", async () => {
    const seed = Manifest.create();
    seed.addTool(SYNTHETIC_TOOL, "9.9.9", []);
    const userManifestRepo = new InMemoryManifestRepository(seed);
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    await useCase.execute(remoteFlow({ aiTools: [SYNTHETIC_TOOL], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getToolVersion(SYNTHETIC_TOOL)).toBe("9.9.9");
    expect(userManifestRepo.saveCount).toBe(0);
  });

  it("writes nothing at all under projectRoot - full directory delta, not a list", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase, deps } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [SYNTHETIC_TOOL], scope: "user" }));

    expect(deps.fs.listUnder(PROJECT_ROOT)).toEqual([]);
  });

  it("writes the user manifest, never this project's own .aidd/manifest.json", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase, deps } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [SYNTHETIC_TOOL], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getInstalledToolIds()).toContain(SYNTHETIC_TOOL);
    expect(await deps.manifestRepo.load()).toBeNull();
  });

  it("hands the machine-wide sync the tools it registered and the plugins it enabled", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const syncSettings = { execute: vi.fn().mockResolvedValue({ updatedTools: [] }) };
    const { useCase } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
      syncSettings,
    });

    await useCase.execute(remoteFlow({ aiTools: [SYNTHETIC_TOOL], scope: "user" }));

    expect(syncSettings.execute).toHaveBeenCalledWith(
      expect.objectContaining({ toolIds: [SYNTHETIC_TOOL], enablePlugins: [] })
    );
  });

  it("installs the named plugins machine-wide and enables exactly those it installed", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const syncSettings = { execute: vi.fn().mockResolvedValue({ updatedTools: [] }) };
    const execute = vi.fn(async () => ({ plugins: ["aidd-dev"] }));
    const { useCase } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
      syncSettings,
      installGlobalPlugins: { execute },
    });

    await useCase.execute(
      remoteFlow({
        aiTools: [SYNTHETIC_TOOL],
        scope: "user",
        pluginMode: "named",
        pluginNames: ["aidd-dev"],
      })
    );

    expect(execute).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      toolIds: [SYNTHETIC_TOOL],
      mode: "named",
      pluginNames: ["aidd-dev"],
    });
    expect(syncSettings.execute).toHaveBeenCalledWith(
      expect.objectContaining({ toolIds: [SYNTHETIC_TOOL], enablePlugins: ["aidd-dev"] })
    );
  });

  it("never installs framework files nor prompts for plugins - no project delivery at all", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    const result = await useCase.execute(remoteFlow({ aiTools: [SYNTHETIC_TOOL], scope: "user" }));

    expect(result.install.results).toEqual([]);
  });

  it("records no shared-source reference - there is no project-scope manifest for a later clean to ever decrement", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const userSourceReferences = makeRecordingUserSourceReferences();
    const { useCase } = await buildUseCase(undefined, userSourceReferences, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [SYNTHETIC_TOOL], scope: "user" }));

    expect(userSourceReferences.added).toEqual([]);
  });
});
