import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginDistributionLoader } from "../../../src/contexts/installation/application/plugin/plugin-distribution-loader.js";
import { ReportStatus } from "../../../src/contexts/installation/application/report-status.js";
import { RestoreGlobal } from "../../../src/contexts/installation/application/restore/project/restore-global.js";
import type { Restore } from "../../../src/contexts/installation/application/restore/restore.js";
import { DetectPluginDrift } from "../../../src/contexts/installation/application/shared/detect-plugin-drift.js";
import { PluginDistributionReaderAdapter } from "../../../src/contexts/installation/infrastructure/plugin-distribution-reader-adapter.js";
import { RestoreAll } from "../../../src/orchestration/global/restore-all.js";
import { ManifestUnavailableError } from "../../../src/shared/domain/errors.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import { buildAddPlugin } from "../../contexts/installation/testing/build-add-plugin.builder.js";
import {
  restoreAllPluginsOf,
  restoreOf,
} from "../../contexts/installation/testing/build-restore.builder.js";
import {
  fakeBuildSources,
  fakeBuiltDeps,
  translateDistribution,
} from "../../contexts/installation/testing/fake-build-sources.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
  initProject,
  installTool,
} from "../../contexts/installation/testing/installation-deps.builder.js";
import { fakeEnsureBuiltMarketplace } from "../../helpers/ports/fake-ensure-built-marketplace.js";
import { CheckboxRecordingPrompter } from "../../shared/testing/checkbox-recording-prompter.fake.js";
import { registeredManifestProbes } from "../../shared/testing/registered-manifest-probes.builder.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  OverwritePrompter,
  ScriptedPrompter,
} from "../../shared/testing/scripted-prompter.fake.js";
import { seedFromDirectory } from "../../shared/testing/seed-from-directory.builder.js";

const PROJECT_ROOT = "/test-project";
const PLUGIN_FIXTURE = join(process.cwd(), "tests/fixtures/plugins/claude-format/sample-plugin");

type Deps = Awaited<ReturnType<typeof buildInstallationDeps>>;

function builtDeps(deps: Deps) {
  return {
    ensureBuilt: fakeEnsureBuiltMarketplace(),
    marketplaceRegistry: deps.marketplaceRegistry,
    homedir: () => "/home/test",
    platform: process.platform,
    translate: translateDistribution,
  };
}

async function installPlugin(
  deps: Deps,
  toolId: AiToolId,
  pluginReader: PluginDistributionReaderAdapter
): Promise<void> {
  await buildAddPlugin(
    { fs: deps.fs, logger: deps.logger },
    { project: deps.manifestRepo, user: deps.userManifestRepo },
    {
      distributionLoader: new PluginDistributionLoader(deps.pluginFetcher, pluginReader),
      marketplaceRegistry: deps.marketplaceRegistry,
      ...fakeBuildSources(),
    },
    registeredTools()
  ).execute({
    githubMarketplace: false,
    source: { kind: "local", path: PLUGIN_FIXTURE },
    toolIds: [toolId],
    projectRoot: PROJECT_ROOT,
    interactive: false,
  });
}

function makeRestoreAll(
  deps: Deps,
  pluginReader: PluginDistributionReaderAdapter,
  prompter: OverwritePrompter | ScriptedPrompter = new OverwritePrompter()
): RestoreAll {
  const statusUseCase = new ReportStatus(
    deps.fs,
    deps.manifestRepo,
    new DetectPluginDrift(deps.fs, registeredTools()),
    registeredTools()
  );
  const restoreUseCase = restoreOf({
    ...deps,
    prompter,
    plugins: restoreAllPluginsOf({
      ...deps,
      pluginDistributionReader: pluginReader,
      builtDeps: builtDeps(deps),
    }),
  });
  return new RestoreAll(
    prompter,
    statusUseCase,
    new RestoreGlobal(deps.manifestRepo, restoreUseCase)
  );
}

function countingReader(fs: Deps["fs"]): {
  reader: PluginDistributionReaderAdapter;
  count: () => number;
} {
  const reader = new PluginDistributionReaderAdapter(fs, registeredManifestProbes());
  let calls = 0;
  const original = reader.read.bind(reader);
  reader.read = async (...args: Parameters<typeof original>) => {
    calls++;
    return original(...args);
  };
  return { reader, count: () => calls };
}

describe("RestoreAll — the --force flag", () => {
  /**
   * `--force` has to reach the use case: folded into `interactive`, a non-TTY run decided
   * with `force: false` and reported "all files are unmodified" over a modified file.
   */
  async function setupWithModifiedTrackedFile(): Promise<{
    deps: Deps;
    reader: PluginDistributionReaderAdapter;
    trackedPath: string;
  }> {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

    const manifest = await deps.manifestRepo.load();
    const tracked = manifest?.getToolFiles(TOOL.claude) ?? [];
    expect(tracked.length, "the fixture must track at least one file").toBeGreaterThan(0);

    const trackedPath = join(PROJECT_ROOT, tracked[0].relativePath);
    await deps.fs.writeFile(trackedPath, "EDITED OUTSIDE THE CLI");

    return {
      deps,
      reader: new PluginDistributionReaderAdapter(deps.fs, registeredManifestProbes()),
      trackedPath,
    };
  }

  it("restores a modified tracked file when force is set", async () => {
    const { deps, reader, trackedPath } = await setupWithModifiedTrackedFile();

    const result = await makeRestoreAll(deps, reader).execute(PROJECT_ROOT, true, false);

    expect(deps.fs.getFile(trackedPath)).not.toBe("EDITED OUTSIDE THE CLI");
    expect(result.errors, "force must reach the decision, not raise InputRequired").toEqual([]);
    expect(result.failed).toBe(false);
    expect(result.totalRestored).toBeGreaterThan(0);
  });

  it("keeps a modified tracked file and reports why when force is not set", async () => {
    const { deps, reader, trackedPath } = await setupWithModifiedTrackedFile();

    const result = await makeRestoreAll(deps, reader).execute(PROJECT_ROOT, false, false);

    expect(deps.fs.getFile(trackedPath)).toBe("EDITED OUTSIDE THE CLI");
    expect(result.totalRestored).toBe(0);
    expect(result.errors.map((e) => e.message).join(" ")).toContain("--force");
    expect(result.failed, "a kept file is an error the run fails on").toBe(true);
  });
});

describe("RestoreAll — an interactive run that ticks nothing", () => {
  it("restores nothing: an empty selection is a decision, not the absence of one", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const manifest = await deps.manifestRepo.load();
    const tracked = manifest?.getToolFiles(TOOL.claude) ?? [];
    const trackedPath = join(PROJECT_ROOT, tracked[0].relativePath);
    await deps.fs.writeFile(trackedPath, "EDITED OUTSIDE THE CLI");
    const prompter = new ScriptedPrompter([ScriptedPrompter.answer.checkbox([])]);

    const result = await makeRestoreAll(
      deps,
      new PluginDistributionReaderAdapter(deps.fs, registeredManifestProbes()),
      prompter
    ).execute(PROJECT_ROOT, false, true);

    expect(deps.fs.getFile(trackedPath)).toBe("EDITED OUTSIDE THE CLI");
    expect(result).toStrictEqual({
      totalRestored: 0,
      totalKept: 0,
      pluginNamesRestored: [],
      errors: [],
      failed: false,
      unrestorable: [],
      nativeOnlyToolIds: [],
    });
  });
});

describe("RestoreAll — plugin materialization", () => {
  it("restores a corrupted plugin file with exactly one materialization call (translate-mode: claude)", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
    await installPlugin(
      deps,
      TOOL.claude,
      new PluginDistributionReaderAdapter(deps.fs, registeredManifestProbes())
    );

    const pluginFile = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
    await deps.fs.writeFile(pluginFile, "CORRUPTED CONTENT");

    // Counting reader wired only from here — installPlugin's own read() must not count.
    const { reader, count } = countingReader(deps.fs);
    const useCase = makeRestoreAll(deps, reader);
    await useCase.execute(PROJECT_ROOT, false, false);

    expect(deps.fs.getFile(pluginFile)).not.toBe("CORRUPTED CONTENT");
    expect(deps.fs.getFile(pluginFile)).toContain("Greet from sample-plugin.");
    expect(count()).toBe(1);
  });

  it("leaves a corrupted shared user plugin to explicit user-scope repair (cursor)", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.cursor);
    await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
    await installPlugin(
      deps,
      TOOL.cursor,
      new PluginDistributionReaderAdapter(deps.fs, registeredManifestProbes())
    );

    const manifestAfterInstall = deps.userManifestRepo.getCurrent();
    const plugin = manifestAfterInstall
      ?.getPlugins(TOOL.cursor)
      .find((p) => p.name === "sample-plugin");
    const trackedRelativePath = [...(plugin?.files.keys() ?? [])][0];
    expect(trackedRelativePath).toBeDefined();
    const pluginFile = join(homedir(), ".cursor/plugins/local", trackedRelativePath as string);
    await deps.fs.writeFile(pluginFile, "CORRUPTED CONTENT");

    const { reader, count } = countingReader(deps.fs);
    const useCase = makeRestoreAll(deps, reader);
    await useCase.execute(PROJECT_ROOT, false, false);

    expect(deps.fs.getFile(pluginFile)).toBe("CORRUPTED CONTENT");
    expect(count()).toBe(0);
  });

  it("result.pluginNamesRestored lists the restored plugin exactly once", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
    const { reader } = countingReader(deps.fs);
    await installPlugin(deps, TOOL.claude, reader);

    const pluginFile = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
    await deps.fs.writeFile(pluginFile, "CORRUPTED CONTENT");

    const result = await makeRestoreAll(deps, reader).execute(PROJECT_ROOT, false, false);

    expect(result.pluginNamesRestored).toEqual(["sample-plugin"]);
    expect(result.errors).toHaveLength(0);
  });

  it("a plugin already up to date is not listed as restored and produces no error", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
    const { reader } = countingReader(deps.fs);
    await installPlugin(deps, TOOL.claude, reader);

    // Nothing corrupted — plugin files are already at their installed state.
    const manifestBefore = await deps.manifestRepo.load();
    const pluginBefore = manifestBefore
      ?.getPlugins(TOOL.claude)
      .find((p) => p.name === "sample-plugin");

    const result = await makeRestoreAll(deps, reader).execute(PROJECT_ROOT, false, false);

    expect(result.pluginNamesRestored).toEqual([]);
    expect(result.errors).toHaveLength(0);
    const manifestAfter = await deps.manifestRepo.load();
    const pluginAfter = manifestAfter
      ?.getPlugins(TOOL.claude)
      .find((p) => p.name === "sample-plugin");
    expect(pluginAfter?.files).toEqual(pluginBefore?.files);
  });

  it("interactive restore with an explicit file selection also skips unselected plugin files (translate-mode)", async () => {
    // The interactive picker never offers plugin drift, so once the user picks any specific
    // regular file ctx.fileFilter is active and no plugin path can match it.
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    await installTool(deps, PROJECT_ROOT, TOOL.vscode);
    await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
    const { reader } = countingReader(deps.fs);
    await installPlugin(deps, TOOL.claude, reader);

    const pluginFile = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
    await deps.fs.writeFile(pluginFile, "CORRUPTED CONTENT");
    // keybindings.json is a plain tracked file (unlike settings.json, which is merge-type
    // and reports composite "path > key" drift entries, not a plain selectable path).
    const vscodeKeybindingsPath = join(PROJECT_ROOT, ".vscode/keybindings.json");
    await deps.fs.writeFile(vscodeKeybindingsPath, "CORRUPTED KEYBINDINGS");

    // Any explicit selection turns fileFilter on, and once on it excludes every plugin path.
    // Whether keybindings.json is itself repaired is not asserted.
    const prompter = new ScriptedPrompter([
      ScriptedPrompter.answer.checkbox([".vscode/keybindings.json"]),
    ]);
    const useCase = makeRestoreAll(deps, reader, prompter);
    await useCase.execute(PROJECT_ROOT, false, true);

    expect(deps.fs.getFile(pluginFile)).toBe("CORRUPTED CONTENT");
  });

  it("unscoped restore still restores every installed AI tool's plugins (no regression)", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    await installTool(deps, PROJECT_ROOT, TOOL.codex);
    await seedFromDirectory(deps.fs, PLUGIN_FIXTURE, { useAbsolutePaths: true });
    const { reader } = countingReader(deps.fs);
    await installPlugin(deps, TOOL.claude, reader);
    await buildAddPlugin(
      { fs: deps.fs, logger: deps.logger },
      { project: deps.manifestRepo, user: deps.userManifestRepo },
      {
        distributionLoader: new PluginDistributionLoader(deps.pluginFetcher, reader),
        marketplaceRegistry: deps.marketplaceRegistry,
        ...fakeBuildSources(),
      },
      registeredTools()
    ).execute({
      githubMarketplace: false,
      source: { kind: "local", path: PLUGIN_FIXTURE },
      toolIds: [TOOL.codex],
      projectRoot: PROJECT_ROOT,
      interactive: false,
    });

    const claudePluginFile = join(PROJECT_ROOT, ".claude/plugins/sample-plugin/commands/greet.md");
    const codexPluginFile = join(PROJECT_ROOT, ".codex/plugins/sample-plugin/commands/greet.md");
    await deps.fs.writeFile(claudePluginFile, "CORRUPTED CLAUDE");
    await deps.fs.writeFile(codexPluginFile, "CORRUPTED CODEX");

    await makeRestoreAll(deps, reader).execute(PROJECT_ROOT, false, false);

    expect(deps.fs.getFile(claudePluginFile)).not.toBe("CORRUPTED CLAUDE");
    expect(deps.fs.getFile(codexPluginFile)).not.toBe("CORRUPTED CODEX");
  });
});

describe("RestoreAll — consent to overwrite", () => {
  type RestoreCommand = Parameters<Restore["execute"]>[0];

  /** Records what RestoreAll asks the restore to do, without doing it. */
  function recordAsks(restoreUseCase: Restore): RestoreCommand[] {
    const seen: RestoreCommand[] = [];
    restoreUseCase.execute = async (options: RestoreCommand) => {
      seen.push(options);
      return {
        tools: [],
        totalRestored: 0,
        totalKept: 0,
        totalPluginFilesRestored: 0,
        restoredPluginNames: [],
        unrestorable: [],
        nativeOnlyToolIds: [],
      };
    };
    return seen;
  }

  async function askedWith(interactive: boolean, force: boolean): Promise<RestoreCommand> {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const prompter = new OverwritePrompter();
    const statusUseCase = new ReportStatus(
      deps.fs,
      deps.manifestRepo,
      new DetectPluginDrift(deps.fs, registeredTools()),
      registeredTools()
    );
    const restoreUseCase = restoreOf({
      ...deps,
      prompter,
      plugins: restoreAllPluginsOf({ ...deps, builtDeps: fakeBuiltDeps() }),
    });
    const seen = recordAsks(restoreUseCase);
    await new RestoreAll(
      prompter,
      statusUseCase,
      new RestoreGlobal(deps.manifestRepo, restoreUseCase)
    ).execute(PROJECT_ROOT, force, interactive);
    const asked = seen[0];
    expect(asked).toBeDefined();
    return asked as RestoreCommand;
  }

  it("carries --force through to the restore it delegates to", async () => {
    expect((await askedWith(false, true)).force).toBe(true);
  });

  it("does not overwrite without consent when neither --force nor a TTY is there", async () => {
    expect((await askedWith(false, false)).force).toBe(false);
  });

  it("treats the interactive file selection as the consent, so nothing is asked twice", async () => {
    expect((await askedWith(true, false)).force).toBe(true);
  });
});

describe("RestoreAll — native-only tools", () => {
  it("forwards the native-only tool ids the restore it delegates to found", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const prompter = new OverwritePrompter();
    const statusUseCase = new ReportStatus(
      deps.fs,
      deps.manifestRepo,
      new DetectPluginDrift(deps.fs, registeredTools()),
      registeredTools()
    );
    const restoreUseCase = restoreOf({
      ...deps,
      prompter,
      plugins: restoreAllPluginsOf({ ...deps, builtDeps: fakeBuiltDeps() }),
    });
    restoreUseCase.execute = async () => ({
      tools: [],
      totalRestored: 0,
      totalKept: 0,
      totalPluginFilesRestored: 0,
      restoredPluginNames: [],
      unrestorable: [],
      nativeOnlyToolIds: [TOOL.claude],
    });

    const result = await new RestoreAll(
      prompter,
      statusUseCase,
      new RestoreGlobal(deps.manifestRepo, restoreUseCase)
    ).execute(PROJECT_ROOT, true, false);

    expect(result.nativeOnlyToolIds).toEqual(["claude"]);
  });
});

type RestoreCommand = Parameters<Restore["execute"]>[0];
type RestoreOutcome = Awaited<ReturnType<Restore["execute"]>>;

const NOTHING_RESTORED: RestoreOutcome = {
  tools: [],
  totalRestored: 0,
  totalKept: 0,
  totalPluginFilesRestored: 0,
  restoredPluginNames: [],
  unrestorable: [],
  nativeOnlyToolIds: [],
};

function restoreAllDelegatingTo(
  deps: Deps,
  prompter: Prompter,
  delegate: (options: RestoreCommand) => Promise<RestoreOutcome>
): RestoreAll {
  const statusUseCase = new ReportStatus(
    deps.fs,
    deps.manifestRepo,
    new DetectPluginDrift(deps.fs, registeredTools()),
    registeredTools()
  );
  const restoreUseCase = restoreOf({
    ...deps,
    prompter,
    plugins: restoreAllPluginsOf({ ...deps, builtDeps: fakeBuiltDeps() }),
  });
  restoreUseCase.execute = delegate;
  return new RestoreAll(
    prompter,
    statusUseCase,
    new RestoreGlobal(deps.manifestRepo, restoreUseCase)
  );
}

function recordingDelegate(): {
  asked: RestoreCommand[];
  delegate: (o: RestoreCommand) => Promise<RestoreOutcome>;
} {
  const asked: RestoreCommand[] = [];
  return {
    asked,
    delegate: async (options) => {
      asked.push(options);
      return NOTHING_RESTORED;
    },
  };
}

describe("RestoreAll — before delegating", () => {
  it("refuses a project that has no manifest", async () => {
    const deps = await buildInstallationDeps();
    const useCase = restoreAllDelegatingTo(
      deps,
      new OverwritePrompter(),
      recordingDelegate().delegate
    );

    const failure = await useCase.execute(PROJECT_ROOT, false, false).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ManifestUnavailableError);
    expect(failure).toMatchObject({ code: "manifest-missing" });
  });

  it.each([
    ["non-interactive", false],
    ["interactive", true],
  ])("reads the manifest once for the whole %s run", async (_mode, interactive) => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    let reads = 0;
    const load = deps.manifestRepo.load.bind(deps.manifestRepo);
    deps.manifestRepo.load = async () => {
      reads += 1;
      return load();
    };

    await restoreAllDelegatingTo(
      deps,
      new CheckboxRecordingPrompter(),
      recordingDelegate().delegate
    ).execute(PROJECT_ROOT, false, interactive);

    expect(reads).toBe(1);
  });

  it("hands the restore the version of the first installed tool", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const { asked, delegate } = recordingDelegate();

    await restoreAllDelegatingTo(deps, new OverwritePrompter(), delegate).execute(
      PROJECT_ROOT,
      false,
      false
    );

    expect(asked.map((o) => o.version)).toStrictEqual(["test"]);
  });

  it("hands the restore an unknown version when no tool is installed", async () => {
    const deps = await buildInstallationDeps();
    await initProject(deps, PROJECT_ROOT);
    const { asked, delegate } = recordingDelegate();

    await restoreAllDelegatingTo(deps, new OverwritePrompter(), delegate).execute(
      PROJECT_ROOT,
      false,
      false
    );

    expect(asked.map((o) => o.version)).toStrictEqual(["unknown"]);
  });

  it("reports a failing restore as a config-restore error with nothing restored", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const useCase = restoreAllDelegatingTo(deps, new OverwritePrompter(), async () => {
      throw new Error("disk on fire");
    });

    const result = await useCase.execute(PROJECT_ROOT, false, false);

    expect(result).toStrictEqual({
      totalRestored: 0,
      totalKept: 0,
      pluginNamesRestored: [],
      errors: [{ scope: "config-restore", message: "disk on fire" }],
      failed: true,
      unrestorable: [],
      nativeOnlyToolIds: [],
    });
  });
});

describe("RestoreAll — the interactive file picker", () => {
  const KEYBINDINGS = ".vscode/keybindings.json";
  const SETTINGS = ".vscode/settings.json";

  async function vscodeProject(): Promise<Deps> {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.vscode);
    return deps;
  }

  it("offers the modified and deleted tracked entries, never a file the user added", async () => {
    const deps = await vscodeProject();
    await deps.fs.writeFile(join(PROJECT_ROOT, KEYBINDINGS), "[]");
    await deps.fs.deleteFile(join(PROJECT_ROOT, ".vscode/extensions.json"));
    await deps.fs.writeFile(join(PROJECT_ROOT, ".vscode/user-added.json"), "{}");
    const prompter = new CheckboxRecordingPrompter();

    await restoreAllDelegatingTo(deps, prompter, recordingDelegate().delegate).execute(
      PROJECT_ROOT,
      false,
      true
    );

    expect(prompter.asks).toStrictEqual([
      {
        message: "Select files to restore:",
        offered: [
          KEYBINDINGS,
          ".vscode/extensions.json > recommendations",
          ".vscode/extensions.json > unwantedRecommendations",
        ],
      },
    ]);
  });

  it("forwards exactly the entries the user ticked", async () => {
    const deps = await vscodeProject();
    await deps.fs.writeFile(join(PROJECT_ROOT, KEYBINDINGS), "[]");
    await deps.fs.deleteFile(join(PROJECT_ROOT, SETTINGS));
    const { asked, delegate } = recordingDelegate();

    await restoreAllDelegatingTo(
      deps,
      new CheckboxRecordingPrompter([KEYBINDINGS]),
      delegate
    ).execute(PROJECT_ROOT, false, true);

    expect(asked.map((o) => o.files)).toStrictEqual([[KEYBINDINGS]]);
  });

  it("never delegates when the user ticked nothing: an empty selection is a decision", async () => {
    const deps = await vscodeProject();
    await deps.fs.writeFile(join(PROJECT_ROOT, KEYBINDINGS), "[]");
    const { asked, delegate } = recordingDelegate();

    await restoreAllDelegatingTo(deps, new CheckboxRecordingPrompter([]), delegate).execute(
      PROJECT_ROOT,
      false,
      true
    );

    expect(asked).toStrictEqual([]);
  });

  it("asks nothing and delegates with no selection when no tracked entry drifted", async () => {
    const deps = await vscodeProject();
    const prompter = new CheckboxRecordingPrompter([KEYBINDINGS]);
    const { asked, delegate } = recordingDelegate();

    await restoreAllDelegatingTo(deps, prompter, delegate).execute(PROJECT_ROOT, false, true);

    expect(prompter.asks).toStrictEqual([]);
    expect(asked.map((o) => o.files)).toStrictEqual([undefined]);
  });
});
