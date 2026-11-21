import path from "node:path";
import type { ValidateRecipesResult } from "../../contexts/recipes/application/validate-recipes.use-case.js";
import type { Output } from "../../orchestration/domain/output.js";
import type { ToolId } from "../../shared/domain/tool.js";
import { printScopedFailures } from "./sync.presenter.js";

interface ScopedFailure {
  readonly scope: string;
  readonly error: unknown;
}

interface UpdatedTool {
  readonly toolId: ToolId;
  readonly fileCount: number;
}

export function printToolAlreadyInstalled(output: Output, toolId: ToolId): void {
  output.warn(`${toolId} is already installed. Use \`--force\` to reinstall.`);
}

export function printToolInstalled(
  output: Output,
  {
    toolId,
    fileCount,
    warnings,
  }: { toolId: ToolId; fileCount: number; warnings: readonly string[] }
): void {
  for (const warning of warnings) output.warn(warning);
  output.success(`Installed ${toolId} (${fileCount} files)`);
}

export function printToolRemoved(output: Output, toolId: ToolId, fileCount: number): void {
  output.success(`Removed ${toolId} (${fileCount} files removed)`);
}

export function printUpdateResult(
  output: Output,
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
