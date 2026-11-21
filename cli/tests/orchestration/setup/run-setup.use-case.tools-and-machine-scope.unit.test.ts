import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { remoteFrameworkSource } from "../../../src/contexts/distribution/contract/framework-source.js";
import { ProjectContext } from "../../../src/contexts/installation/contract/project-context.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { UserScopeUnavailableError } from "../../../src/orchestration/orchestration.error.js";
import { SetupFlow } from "../../../src/orchestration/setup/setup-flow.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { flowTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  buildUseCase,
  makeRecordingUserSourceReferences,
  PROJECT_ROOT,
  remoteFlow,
} from "../testing/run-setup-scenario.builder.js";

describe("setup interactive tool selection", () => {
  function _interactiveFlow(
    opts: Partial<{ aiTools: ToolId[]; ideTools: ToolId[] }> = {}
  ): SetupFlow {
    return new SetupFlow({
      ...flowTools(),
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
    const answer = vi.fn(async () => ({ aiTools: [TOOL.cursor], ideTools: [] }));
    const { useCase, deps } = await buildUseCase({ execute: answer }, undefined, undefined, {
      detectContext: true,
    });
    deps.fs.setFile(join(PROJECT_ROOT, "tsconfig.json"), "{}");

    const result = await useCase.execute(
      remoteFlow({ aiTools: [TOOL.claude, TOOL.cursor], ideTools: [TOOL.vscode] })
    );

    expect(answer).toHaveBeenCalledWith({
      interactive: false,
      aiTools: [TOOL.claude, TOOL.cursor],
      ideTools: [TOOL.vscode],
      context: new ProjectContext({ stack: "typescript", isMonorepo: false, hasFramework: false }),
    });
    if (result.kind === "initialized") {
      expect(result.install.results.map((r) => r.toolId)).toEqual(["cursor"]);
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
      useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }))
    ).rejects.toThrow(UserScopeUnavailableError);
  });

  it("reports a first run as initialized, installing nothing", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

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

    const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

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
    seed.addTool(TOOL.codex, "9.9.9", []);
    const userManifestRepo = new InMemoryManifestRepository(seed);
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getInstalledToolIds()).toStrictEqual(["codex", "claude"]);
  });

  it("registers a new tool with no files and saves the manifest once", async () => {
    const userManifestRepo = new InMemoryManifestRepository(Manifest.create());
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getToolFiles(TOOL.claude)).toStrictEqual([]);
    expect(userManifestRepo.saveCount).toBe(1);
  });

  it("leaves an already-registered tool at its recorded version, saving nothing", async () => {
    const seed = Manifest.create();
    seed.addTool(TOOL.claude, "9.9.9", []);
    const userManifestRepo = new InMemoryManifestRepository(seed);
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getToolVersion(TOOL.claude)).toBe("9.9.9");
    expect(userManifestRepo.saveCount).toBe(0);
  });

  it("writes nothing at all under projectRoot - full directory delta, not a list", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase, deps } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(deps.fs.listUnder(PROJECT_ROOT)).toEqual([]);
  });

  it("writes the user manifest, never this project's own .aidd/manifest.json", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase, deps } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(userManifestRepo.getCurrent()?.getInstalledToolIds()).toContain("claude");
    expect(await deps.manifestRepo.load()).toBeNull();
  });

  it("hands the machine-wide sync the tools it registered and the plugins it enabled", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const syncSettingsUseCase = { execute: vi.fn().mockResolvedValue({ updatedTools: [] }) };
    const { useCase } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
      syncSettingsUseCase,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(syncSettingsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ toolIds: [TOOL.claude], enablePlugins: [] })
    );
  });

  it("installs the named plugins machine-wide and enables exactly those it installed", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const syncSettingsUseCase = { execute: vi.fn().mockResolvedValue({ updatedTools: [] }) };
    const execute = vi.fn(async () => ({ plugins: ["aidd-dev"] }));
    const { useCase } = await buildUseCase(undefined, undefined, undefined, {
      userManifestRepo,
      syncSettingsUseCase,
      installGlobalPlugins: { execute },
    });

    await useCase.execute(
      remoteFlow({
        aiTools: [TOOL.claude],
        scope: "user",
        pluginMode: "named",
        pluginNames: ["aidd-dev"],
      })
    );

    expect(execute).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      toolIds: [TOOL.claude],
      mode: "named",
      pluginNames: ["aidd-dev"],
    });
    expect(syncSettingsUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ toolIds: [TOOL.claude], enablePlugins: ["aidd-dev"] })
    );
  });

  it("never installs framework files nor prompts for plugins - no project delivery at all", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const { useCase } = await buildUseCase(undefined, undefined, undefined, { userManifestRepo });

    const result = await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(result.install.results).toEqual([]);
  });

  it("records no shared-source reference - there is no project-scope manifest for a later clean to ever decrement", async () => {
    const userManifestRepo = new InMemoryManifestRepository();
    const userSourceReferences = makeRecordingUserSourceReferences();
    const { useCase } = await buildUseCase(undefined, userSourceReferences, undefined, {
      userManifestRepo,
    });

    await useCase.execute(remoteFlow({ aiTools: [TOOL.claude], scope: "user" }));

    expect(userSourceReferences.added).toEqual([]);
  });
});
