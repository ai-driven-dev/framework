import { InitProject } from "../../contexts/installation/application/init-project.js";
import { RunSetup } from "../../orchestration/setup/run-setup.js";
import { SetupPluginsPromptUseCase } from "../../presentation/prompts/setup-plugins-prompt-use-case.js";
import { SetupToolsPromptUseCase } from "../../presentation/prompts/setup-tools-prompt-use-case.js";
import type { Base } from "./base.js";
import type { Global } from "./global.js";
import type { Marketplace } from "./marketplace.js";
import type { Plugin } from "./plugin.js";

/** `setup`: the questions it asks about plugins and tools, and the scenario that runs them. */
export function wireSetup(base: Base, p: Plugin, m: Marketplace, g: Global) {
  const { fs, manifestRepo, prompter, currentVersionProvider } = base;
  const { marketplaceRegistry, resolveMarketplaceUseCase } = base;
  const { pluginInstallFromMarketplaceUseCase, pluginPickUseCase } = p;
  const setupPluginsPromptUseCase = new SetupPluginsPromptUseCase(
    pluginPickUseCase,
    pluginInstallFromMarketplaceUseCase,
    marketplaceRegistry,
    resolveMarketplaceUseCase
  );
  const setupToolsPromptUseCase = new SetupToolsPromptUseCase(prompter);
  const runSetup = new RunSetup(
    {
      registration: m.setupMarketplaceRegistration,
      installTools: g.setupToolsUseCase,
      syncSettings: (options) => m.marketplaceSyncSettingsUseCase.execute(options),
      version: currentVersionProvider,
      detectContext: g.projectContextDetector,
      machineScope: g.setupMachineScope,
    },
    {
      plugins: (options) => setupPluginsPromptUseCase.execute(options),
      tools: (options) => setupToolsPromptUseCase.execute(options),
    },
    new InitProject(fs, manifestRepo)
  );
  return { setupPluginsPromptUseCase, runSetup };
}
