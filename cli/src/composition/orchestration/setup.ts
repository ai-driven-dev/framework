import { homedir } from "node:os";
import { AgentPluginHosts } from "../../contexts/installation/application/agents/agent-plugin-hosts.js";
import { MainSessionLocator } from "../../contexts/installation/application/agents/main-session-locator.js";
import { MainSessionModels } from "../../contexts/installation/application/agents/main-session-models.js";
import { RecordAgentProviders } from "../../contexts/installation/application/agents/record-agent-providers.js";
import { RestoreAgentProviders } from "../../contexts/installation/application/agents/restore-agent-providers.js";
import { RestoreMainSessionModels } from "../../contexts/installation/application/agents/restore-main-session-models.js";
import { InitProject } from "../../contexts/installation/application/init-project.js";
import { jsoncMainSessionSettings } from "../../contexts/installation/infrastructure/jsonc-main-session-settings.js";
import { RefreshAgentPlugins } from "../../orchestration/agent-models/refresh-agent-plugins.js";
import { SetAgentModels } from "../../orchestration/agent-models/set-agent-models.js";
import {
  RunSetup,
  type SetupQuestions,
  type SetupSteps,
} from "../../orchestration/setup/run-setup.js";
import { ChoosePlugins } from "../../orchestration/setup/steps/choose-plugins.js";
import { ChooseTools } from "../../orchestration/setup/steps/choose-tools.js";
import type { Installation } from "../installation.js";
import type { Base } from "../shared.js";
import type { Global } from "./global.js";
import type { Marketplace } from "./marketplace.js";
import type { Plugin } from "./plugin.js";

/** What a project-scope setup does at each stage. */
export function setupStepsOf(
  base: Pick<Base, "currentVersionProvider">,
  m: {
    readonly resolveSetupSource: SetupSteps["resolveSource"];
    readonly registerSetupSource: SetupSteps["register"];
    readonly syncSettingsUseCase: Pick<Marketplace["syncSettingsUseCase"], "execute">;
  },
  g: Pick<Global, "setupToolsUseCase" | "projectContextDetector" | "setupMachineScope">
): SetupSteps {
  return {
    resolveSource: m.resolveSetupSource,
    register: m.registerSetupSource,
    installTools: g.setupToolsUseCase,
    syncSettings: (options) => m.syncSettingsUseCase.execute(options),
    version: base.currentVersionProvider,
    detectContext: g.projectContextDetector,
    machineScope: g.setupMachineScope,
  };
}

/** What a setup asks a person, answered by the prompts that own the questions. */
export function setupQuestionsOf(
  plugins: Pick<ChoosePlugins, "execute">,
  tools: Pick<ChooseTools, "execute">
): SetupQuestions {
  return {
    plugins: (options) => plugins.execute(options),
    tools: (options) => tools.execute(options),
  };
}

/** The agents' provider and the main session's model, which `setup --provider` sets and
 * `clean --global` forgets. */
export function wireAgentModels(
  base: Base,
  inst: Pick<Installation, "agentModelStore">,
  p: Plugin,
  m: Marketplace
) {
  const { fs, manifestRepo, userManifestRepo, environment } = base;
  const { agentModelStore } = inst;
  const mainSessions = new MainSessionModels(
    fs,
    agentModelStore,
    jsoncMainSessionSettings,
    new MainSessionLocator(fs, homedir, environment, base.tools)
  );
  const refresh = new RefreshAgentPlugins(
    new AgentPluginHosts(manifestRepo, userManifestRepo),
    p.pluginUpdateUseCase,
    p.userPluginUpdateUseCase,
    m.syncSettingsUseCase
  );
  return new SetAgentModels(
    new RecordAgentProviders(agentModelStore, base.tools),
    new RestoreAgentProviders(agentModelStore),
    mainSessions,
    new RestoreMainSessionModels(agentModelStore, mainSessions),
    refresh
  );
}

/** `setup`: the questions it asks about plugins and tools, and the scenario that runs them. */
export function wireSetup(
  base: Base,
  inst: Pick<Installation, "updateGitignore">,
  p: Plugin,
  m: Marketplace,
  g: Global
) {
  const { fs, manifestRepo, prompter } = base;
  const { resolveMarketplaceUseCase } = base;
  const { pluginInstallFromMarketplaceUseCase, pickPlugins } = p;
  const choosePlugins = new ChoosePlugins(
    pickPlugins,
    pluginInstallFromMarketplaceUseCase,
    base.listMarketplaces,
    resolveMarketplaceUseCase
  );
  const chooseTools = new ChooseTools(prompter, base.tools);
  const runSetup = new RunSetup(
    setupStepsOf(base, m, g),
    setupQuestionsOf(choosePlugins, chooseTools),
    new InitProject(fs, manifestRepo, inst.updateGitignore, base.tools)
  );
  return { choosePlugins, chooseTools, runSetup };
}
