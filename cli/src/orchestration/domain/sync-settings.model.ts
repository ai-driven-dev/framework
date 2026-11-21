import type { HintedMessage } from "../../shared/domain/describe-error.js";
import type { Scope } from "../../shared/domain/scope.js";
import type { ToolId } from "../../shared/domain/tool.js";

export interface SyncSettingsRequest {
  projectRoot: string;
  /** Limits both the settings sync and the native activation to these tools; every
   * installed tool when absent. */
  toolIds?: readonly ToolId[];
  /** Re-registers the framework marketplace when this run finds none at all: `sync` alone
   * sets it, so every other caller reads an empty registry as found rather than repopulating it. */
  recreateFrameworkIfMissing?: boolean;
  /**
   * The scope this run enables plugins at, which is a different question than a marketplace's
   * own `scope`. `"user"` also writes nothing under `projectRoot`, so `syncTool` is skipped.
   */
  scope?: Scope;
  /**
   * Narrows the settings sync and native activation to the marketplaces named here; absent
   * activates every registered one. A name matching nothing resolves to zero marketplaces,
   * never a fallback to every one.
   */
  marketplaceNames?: readonly string[];
  /**
   * Framework plugins a tool with native activation also enables at this run's scope, on top
   * of the ones its manifest records: what `setup --global --plugins` asks for, since a
   * machine-scope install records no plugin a host loads by itself.
   */
  enablePlugins?: readonly string[];
}

export interface SyncSettingsResult {
  /** Tools whose own CLI actually ran, whether or not every step inside it succeeded. */
  activated: readonly ToolId[];
  /** Tools with a native activation whose binary was not on PATH: nothing of theirs
   * ran, so the settings this pass wrote will not load until it has. */
  binaryMissing: readonly { toolId: ToolId; binary: string }[];
  /** What a recoverable, best-effort step logged: the same text `logger.warn` received. */
  warnings: readonly (string | HintedMessage)[];
  /** A hard failure that is not the recoverable `NativePluginCliError` family: a bug in an
   * activator, or the source-conflict guard's deliberate refusal. Returned rather than thrown,
   * so whether the whole command fails stays the caller's decision. */
  errors: readonly { scope: string; error: unknown }[];
  /** The verdict on `errors`: one returned error fails the run. Decided here, where the errors
   * are produced, so a command only prints it and exits on it. */
  failed: boolean;
}
