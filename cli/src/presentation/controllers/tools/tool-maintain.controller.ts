import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import {
  printToolRemoved,
  printUpdateResult,
} from "../../presenters/tools/tool-config.presenter.js";
import { assertKnownToolId } from "../../presenters/tools/tool-id.presenter.js";
import type { ToolRun } from "./tool-config-run.controller.js";

export async function removeTool({
  container,
  output,
  projectRoot,
  raw,
  catalog,
}: ToolRun & { raw: string; catalog: ToolCatalog }): Promise<void> {
  const toolId = assertKnownToolId(raw, catalog);

  const results = await container.clean.uninstallTools.execute({
    toolIds: [toolId],
    projectRoot,
  });
  const totalFileCount = results.reduce((sum, r) => sum + r.fileCount, 0);
  printToolRemoved(output, results[0].toolId, totalFileCount);
}

export async function updateTools({
  container,
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

  const result = await container.global.updateTools.execute({
    toolArg: toolId,
    projectRoot,
    userForce: cmdOptions.force,
    interactive,
  });
  printUpdateResult(output, result.updatedTools, result.errors);
}
