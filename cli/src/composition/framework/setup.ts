import { InitProject } from "../../contexts/installation/application/init-project.js";
import {
  RunSetup,
  type SetupQuestions,
  type SetupSteps,
} from "../../orchestration/setup/run-setup.js";
import { SetupPluginsPromptUseCase } from "../../presentation/prompts/setup-plugins-prompt-use-case.js";
import { SetupToolsPromptUseCase } from "../../presentation/prompts/setup-tools-prompt-use-case.js";
import type { Base } from "./base.js";
import type { Global } from "./global.js";
import type { Marketplace } from "./marketplace.js";
import type { Plugin } from "./plugin.js";

/** What a project-scope setup does at each stage. */
export function setupStepsOf(
  base: Pick<Base, "currentVersionProvider">,
  m: Pick<Marketplace, "setupMarketplaceRegistration"> & {
    readonly marketplaceSyncSettingsUseCase: Pick<
      Marketplace["marketplaceSyncSettingsUseCase"],
      "execute"
    >;
  },
  g: Pick<Global, "setupToolsUseCase" | "projectContextDetector" | "setupMachineScope">
): SetupSteps {
  return {
    registration: m.setupMarketplaceRegistration,
    installTools: g.setupToolsUseCase,
    syncSettings: (options) => m.marketplaceSyncSettingsUseCase.execute(options),
    version: base.currentVersionProvider,
    detectContext: g.projectContextDetector,
    machineScope: g.setupMachineScope,
  };
}

/** What a setup asks a person, answered by the prompts that own the questions. */
export function setupQuestionsOf(
  plugins: Pick<SetupPluginsPromptUseCase, "execute">,
  tools: Pick<SetupToolsPromptUseCase, "execute">
): SetupQuestions {
  return {
    plugins: (options) => plugins.execute(options),
    tools: (options) => tools.execute(options),
  };
}

/** `setup`: the questions it asks about plugins and tools, and the scenario that runs them. */
export function wireSetup(base: Base, p: Plugin, m: Marketplace, g: Global) {
  const { fs, manifestRepo, prompter } = base;
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
    setupStepsOf(base, m, g),
    setupQuestionsOf(setupPluginsPromptUseCase, setupToolsPromptUseCase),
    new InitProject(fs, manifestRepo)
  );
  return { setupPluginsPromptUseCase, runSetup };
}
