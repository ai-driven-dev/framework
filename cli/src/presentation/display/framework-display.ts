import path from "node:path";
import type { ValidateRecipesResult } from "../../contexts/recipes/application/validate-recipes.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import { SyncFailedError } from "../../shared/domain/errors.js";
import type { ToolId } from "../../shared/domain/tool.js";
import type { Deps } from "../deps.js";
import type { CLIOutput } from "../output.js";

interface ScopedFailure {
  readonly scope: string;
  readonly message: string;
}

interface UpdatedTool {
  readonly toolId: ToolId;
  readonly fileCount: number;
}

export function printToolAlreadyInstalled(output: CLIOutput, toolId: ToolId): void {
  output.warn(`${toolId} is already installed. Use \`--force\` to reinstall.`);
}

export function printToolInstalled(
  output: CLIOutput,
  toolId: ToolId,
  fileCount: number,
  warnings: readonly string[]
): void {
  for (const warning of warnings) output.warn(warning);
  output.success(`Installed ${toolId} (${fileCount} files)`);
}

export function printToolRemoved(output: CLIOutput, toolId: ToolId, fileCount: number): void {
  output.success(`Removed ${toolId} (${fileCount} files removed)`);
}

export function printScopedFailures(output: CLIOutput, failures: readonly ScopedFailure[]): void {
  for (const failure of failures) output.warn(`[${failure.scope}] ${failure.message}`);
}

export function printUpdateResult(
  output: CLIOutput,
  updatedTools: readonly UpdatedTool[],
  errors: readonly ScopedFailure[]
): void {
  if (updatedTools.length === 0 && errors.length === 0) {
    output.info("No tools installed.");
    return;
  }
  for (const tool of updatedTools) {
    output.success(`Updated ${tool.toolId} (${tool.fileCount} files)`);
  }
  printScopedFailures(output, errors);
}

function escapeCell(value: string | number): string {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderRecipeValidation(result: ValidateRecipesResult, projectRoot: string): string {
  if (result.findings.length === 0) return `PASS: ${result.fileCount} recipe(s) validated.`;
  const rows = result.findings.map((finding) => {
    const relative = path.relative(projectRoot, finding.file).replaceAll(path.sep, "/");
    const file =
      relative && !relative.startsWith("../") ? relative : finding.file.replaceAll(path.sep, "/");
    return `| ${[file, finding.line, finding.rule, finding.fix].map(escapeCell).join(" | ")} |`;
  });
  return [
    "| File | Line | Rule | Fix |",
    "| --- | ---: | --- | --- |",
    ...rows,
    "",
    `FAIL: ${result.findings.length} finding(s) in ${result.fileCount} recipe(s).`,
  ].join("\n");
}

/** What this command reads of the graph. */
type SyncActivationKeys = "syncSettingsUseCase";

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
  const activation = await deps.syncSettingsUseCase.execute({
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
