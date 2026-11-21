import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ReportStatus } from "../../../src/contexts/installation/application/report-status.js";
import { RestoreGlobal } from "../../../src/contexts/installation/application/restore/project/restore-global.js";
import type { Restore } from "../../../src/contexts/installation/application/restore/restore.js";
import { DetectPluginDrift } from "../../../src/contexts/installation/application/shared/detect-plugin-drift.js";
import { ManifestUnavailableError } from "../../../src/contexts/installation/domain/installation.error.js";
import { RestoreAll } from "../../../src/orchestration/global/restore-all.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import {
  restoreAllPluginsOf,
  restoreOf,
} from "../../contexts/installation/testing/build-restore.builder.js";
import { fakeBuiltDeps } from "../../contexts/installation/testing/fake-build-sources.fake.js";
import { CheckboxRecordingPrompter } from "../../shared/testing/checkbox-recording-prompter.fake.js";
import {
  buildInstallationDeps,
  initAndInstall,
  initProject,
} from "../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { OverwritePrompter } from "../../shared/testing/scripted-prompter.fake.js";

const PROJECT_ROOT = "/test-project";

type Deps = Awaited<ReturnType<typeof buildInstallationDeps>>;

describe("RestoreAll - consent to overwrite", () => {
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
      {
        fs: deps.fs,
        manifestRepo: deps.manifestRepo,
        detectPluginDrift: new DetectPluginDrift(deps.fs, registeredTools()),
      },
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
    if (asked === undefined) throw new Error("restore was never asked to do anything");
    return asked;
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

describe("RestoreAll - native-only tools", () => {
  it("forwards the native-only tool ids the restore it delegates to found", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const prompter = new OverwritePrompter();
    const statusUseCase = new ReportStatus(
      {
        fs: deps.fs,
        manifestRepo: deps.manifestRepo,
        detectPluginDrift: new DetectPluginDrift(deps.fs, registeredTools()),
      },
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
    {
      fs: deps.fs,
      manifestRepo: deps.manifestRepo,
      detectPluginDrift: new DetectPluginDrift(deps.fs, registeredTools()),
    },
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

describe("RestoreAll - before delegating", () => {
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
      errors: [{ scope: "config-restore", error: new Error("disk on fire") }],
      failed: true,
      unrestorable: [],
      nativeOnlyToolIds: [],
    });
  });
});

describe("RestoreAll - the interactive file picker", () => {
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
