import type { RestoreTool } from "../../../src/contexts/installation/application/restore/project/restore-tool.use-case.js";
import type { SyncSettingsResult } from "../../../src/orchestration/domain/sync-settings.model.js";
import type { RestoreAllResult } from "../../../src/orchestration/sync/restore-all.use-case.js";
import { RunSync, type RunSyncReport } from "../../../src/orchestration/sync/run-sync.use-case.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";

type ToolRestoreResult = Awaited<ReturnType<RestoreTool["execute"]>>;

export const RESTORED_NOTHING: RestoreAllResult = {
  totalRestored: 0,
  totalKept: 0,
  pluginNamesRestored: [],
  errors: [],
  failed: false,
  unrestorable: [],
  nativeOnlyToolIds: [],
};

export const ACTIVATED_NOTHING: SyncSettingsResult = {
  activated: [],
  binaryMissing: [],
  warnings: [],
  errors: [],
  failed: false,
};

function toolRestoredNothing(claude: AiToolId): ToolRestoreResult {
  return {
    tools: [{ toolId: claude, nothingToRestore: true, restored: [], kept: [], unrestorable: [] }],
    totalRestored: 0,
    totalKept: 0,
    totalPluginFilesRestored: 0,
    restoredPluginNames: [],
    unrestorable: [],
    nativeOnlyToolIds: [],
  };
}

/** A `RunSync` over fakes that record every call and report, in the order they happened. */
export function aRunSync(answers: {
  claude: AiToolId;
  restoreAll?: RestoreAllResult;
  restoreTool?: ToolRestoreResult;
  activation?: SyncSettingsResult;
}) {
  const calls: string[] = [];
  const restoreAllArgs: unknown[][] = [];
  const restoreToolCommands: unknown[] = [];
  const syncCommands: unknown[] = [];
  const report: RunSyncReport = {
    restored: () => calls.push("report restored"),
    toolRestored: () => calls.push("report toolRestored"),
    activated: () => calls.push("report activated"),
  };
  const useCase = new RunSync(
    {
      execute: async (...args) => {
        calls.push("restoreAll");
        restoreAllArgs.push(args);
        return answers.restoreAll ?? RESTORED_NOTHING;
      },
    },
    {
      execute: async (command) => {
        calls.push("restoreTool");
        restoreToolCommands.push(command);
        return answers.restoreTool ?? toolRestoredNothing(answers.claude);
      },
    },
    {
      execute: async (command) => {
        calls.push("syncSettings");
        syncCommands.push(command);
        return answers.activation ?? ACTIVATED_NOTHING;
      },
    }
  );
  return { useCase, report, calls, restoreAllArgs, restoreToolCommands, syncCommands };
}
