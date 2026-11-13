import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import { SyncFailedError } from "../../shared/domain/errors.js";
import type { Deps } from "../deps.js";
import { printScopedFailures } from "../display/framework-display.js";
import type { CLIOutput } from "../output.js";

/** What this command reads of the graph. */
type SyncActivationKeys = "marketplaceSyncSettingsUseCase";

/** Named structurally: every real caller's result already satisfies this shape. */
interface SyncActivationOutcome {
  readonly errors: readonly { scope: string; message: string }[];
}

/** Drives native activation and surfaces what it did: a result thrown away turns a refusal
 * into exit 0 with nothing printed and a plugin that never loads. Every command driving
 * activation reads it here, never a second way. */
export async function syncNativeActivation(
  deps: Pick<Deps, SyncActivationKeys>,
  output: CLIOutput,
  catalog: ToolCatalog,
  projectRoot: string,
  /** Narrows activation to these marketplaces alone; omitted, every registered one is
   * re-driven. */
  marketplaceNames?: readonly string[]
): Promise<void> {
  const activation = await deps.marketplaceSyncSettingsUseCase.execute({
    projectRoot,
    tools: catalog,
    marketplaceNames,
  });
  reportSyncActivation(output, activation);
}

/** The print-and-throw half of {@link syncNativeActivation}, for a caller whose own use case
 * already ran `execute`: calling it a second time here would run every tool's own CLI twice
 * for one command. */
export function reportSyncActivation(output: CLIOutput, activation: SyncActivationOutcome): void {
  printScopedFailures(output, activation.errors);
  if (activation.errors.length > 0) throw new SyncFailedError(activation.errors);
}
