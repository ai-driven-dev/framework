import { SetupPluginsPromptUseCase } from "../../presentation/prompts/setup-plugins-prompt-use-case.js";
import { SetupToolsPromptUseCase } from "../../presentation/prompts/setup-tools-prompt-use-case.js";
import type { Base } from "./base.js";
import type { Plugin } from "./plugin.js";

/** The questions `setup` asks about plugins and tools. */
export function wireSetup(base: Base, p: Plugin) {
  const { prompter, marketplaceRegistry, resolveMarketplaceUseCase } = base;
  const { pluginInstallFromMarketplaceUseCase, pluginPickUseCase } = p;
  const setupPluginsPromptUseCase = new SetupPluginsPromptUseCase(
    pluginPickUseCase,
    pluginInstallFromMarketplaceUseCase,
    marketplaceRegistry,
    resolveMarketplaceUseCase
  );
  const setupToolsPromptUseCase = new SetupToolsPromptUseCase(prompter);
  return { setupPluginsPromptUseCase, setupToolsPromptUseCase };
}
