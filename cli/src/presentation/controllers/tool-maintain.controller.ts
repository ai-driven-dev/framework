import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import { printToolRemoved, printUpdateResult } from "../presenters/tool-config.presenter.js";
import { assertKnownToolId, type ToolRun } from "./tool-config-run.controller.js";

export async function removeTool({
  deps,
  output,
  projectRoot,
  raw,
  catalog,
}: ToolRun & { raw: string; catalog: ToolCatalog }): Promise<void> {
  const toolId = assertKnownToolId(raw, catalog);

  const results = await deps.uninstallTools.execute({
    toolIds: [toolId],
    projectRoot,
  });
  const totalFileCount = results.reduce((sum, r) => sum + r.fileCount, 0);
  printToolRemoved(output, results[0].toolId, totalFileCount);
}

export async function updateTools({
  deps,
  output,
  projectRoot,
  raw,
  cmdOptions,
  catalog,
}: ToolRun & {
  raw: string | undefined;
  cmdOptions: { force: boolean };
  catalog: ToolCatalog;
}): Promise<void> {
  const toolId = raw === undefined ? undefined : assertKnownToolId(raw, catalog);
  const interactive = process.stdout.isTTY ?? false;

  const result = await deps.updateToolsUseCase.execute({
    toolArg: toolId,
    projectRoot,
    userForce: cmdOptions.force,
    interactive,
  });
  printUpdateResult(output, result.updatedTools, result.errors);
}
