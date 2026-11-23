import type { FrameworkSource } from "../../../contexts/distribution/contract/framework-source.js";
import type { PluginInstallMode } from "../../../contexts/installation/contract/setup/setup-request-rules.model.js";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import { SetupFlow } from "../../../orchestration/setup/setup-flow.model.js";
import type { Output } from "../../terminal/output.model.js";
import { parseScopeFlag } from "../menu/global-options.controller.js";
import {
  activatesAtUserScope,
  parsePluginsFlag,
  parseSourceFlag,
  parseToolIds,
  type SetupCmdOptions,
} from "./setup-flags.controller.js";

export interface SetupRequest {
  source: FrameworkSource | undefined;
  scope: ReturnType<typeof parseScopeFlag>;
  toolIds: { aiTools: string[]; ideTools: string[] };
  interactive: boolean;
  plugins: { mode: PluginInstallMode; names: string[] };
}

/** Whether the run may ask questions: on a terminal, and with no flag that scripts it. */
export function isInteractiveRun(isTty: boolean, scriptingFlags: readonly unknown[]): boolean {
  return isTty && !scriptingFlags.some(Boolean);
}

export function parseSetupRequest(
  cmdOptions: SetupCmdOptions,
  output: Output,
  catalog: ToolCatalog
): SetupRequest {
  const source = parseSourceFlag(cmdOptions, output);
  const scope = cmdOptions.global === true ? "user" : parseScopeFlag(cmdOptions.scope, output);
  const toolIds = parseToolIds(cmdOptions, catalog);

  const interactive = isInteractiveRun(process.stdout.isTTY, [
    cmdOptions.source,
    cmdOptions.release,
    cmdOptions.ai,
    cmdOptions.ide,
    cmdOptions.plugins,
    cmdOptions.yes,
    cmdOptions.global,
    cmdOptions.provider,
  ]);
  return {
    source,
    scope,
    toolIds,
    interactive,
    plugins: parsePluginsFlag(cmdOptions.plugins, interactive),
  };
}

export function buildSetupFlow(
  {
    projectRoot,
    catalog,
    cmdOptions,
  }: { projectRoot: string; catalog: ToolCatalog; cmdOptions: SetupCmdOptions },
  request: SetupRequest
): SetupFlow {
  return new SetupFlow({
    projectRoot,
    registeredToolIds: catalog.idsInCanonicalOrder(),
    aiToolIds: catalog.idsInCanonicalOrder("ai"),
    ideToolIds: catalog.idsInCanonicalOrder("ide"),
    supportsUserScopeActivation: (id) => activatesAtUserScope(catalog.profile(id)),
    source: request.source,
    aiTools: request.toolIds.aiTools,
    ideTools: request.toolIds.ideTools,
    pluginMode: request.plugins.mode,
    pluginNames: request.plugins.names,
    interactive: request.interactive,
    force: false,
    registerDefaultMarketplace: cmdOptions.defaultMarketplace !== false,
    scope: request.scope,
  });
}
