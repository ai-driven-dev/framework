import path from "node:path";
import type { ValidateRecipesResult } from "../../contexts/recipes/application/validate-recipes.use-case.js";

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
