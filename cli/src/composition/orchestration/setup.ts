import { LocateAgentPlugins } from "../../contexts/installation/application/agents/locate-agent-plugins.use-case.js";
import { LocateMainSession } from "../../contexts/installation/application/agents/locate-main-session.use-case.js";
import { MainSessionModels } from "../../contexts/installation/application/agents/main-session-models.use-case.js";
import { RecordAgentProviders } from "../../contexts/installation/application/agents/record-agent-providers.use-case.js";
import { RestoreAgentProviders } from "../../contexts/installation/application/agents/restore-agent-providers.use-case.js";
import { RestoreMainSessionModels } from "../../contexts/installation/application/agents/restore-main-session-models.use-case.js";
import { InitProject } from "../../contexts/installation/application/init-project.use-case.js";
import { jsoncMainSessionSettings } from "../../contexts/installation/infrastructure/jsonc-main-session-settings.js";
import { RefreshAgentPlugins } from "../../orchestration/agent-models/refresh-agent-plugins.use-case.js";
import { ResetAgentModels } from "../../orchestration/agent-models/reset-agent-models.use-case.js";
import { SetAgentModels } from "../../orchestration/agent-models/set-agent-models.use-case.js";
import { RunSetup } from "../../orchestration/setup/run-setup.use-case.js";
import { ChoosePlugins } from "../../orchestration/setup/steps/choose-plugins.use-case.js";
import { ChooseTools } from "../../orchestration/setup/steps/choose-tools.use-case.js";
import { InstallSetupTools } from "../../orchestration/setup/steps/install-setup-tools.use-case.js";
import { PrepareSetupProject } from "../../orchestration/setup/steps/prepare-setup-project.use-case.js";
import type { Installation } from "../contexts/installation.js";
import type { Base } from "../shared.js";
import type { Global } from "./global.js";
import type { Marketplace } from "./marketplace.js";
import type { Plugin } from "./plugin.js";

/** The agents' provider and the main session's model, which `setup --provider` sets and
 * `clean --global` forgets. */
export function wireAgentModels({
  base,
  installation: inst,
  plugin: p,
  marketplace: m,
}: {
  base: Base;
  installation: Pick<Installation, "agentModelStore">;
  plugin: Plugin;
  marketplace: Marketplace;
}) {
  const { fs, manifestRepo, userManifestRepo, environment } = base;
  const { agentModelStore } = inst;
  const mainSessions = new MainSessionModels({
    fs,
    store: agentModelStore,
    settings: jsoncMainSessionSettings,
    mainSessionLocator: new LocateMainSession(
      { fs, homedir: base.homedir, environment },
      base.tools
    ),
  });
  const refresh = new RefreshAgentPlugins({
    pluginHosts: new LocateAgentPlugins(manifestRepo, userManifestRepo),
    updatePlugin: p.pluginUpdateUseCase,
    updateUserPlugin: p.userPluginUpdateUseCase,
    syncSettings: m.syncSettingsUseCase,
  });
  const restoreProviders = new RestoreAgentProviders(agentModelStore);
  return {
    setAgentModels: new SetAgentModels({
      recordProviders: new RecordAgentProviders(agentModelStore, base.tools),
      restoreProviders,
      mainSessions,
      refresh,
    }),
    resetAgentModels: new ResetAgentModels({
      restoreProviders,
      restoreMainSessions: new RestoreMainSessionModels(agentModelStore, mainSessions),
    }),
  };
}

/** `setup`: the questions it asks about plugins and tools, and the scenario that runs them. */
export function wireSetup({
  base,
  installation: inst,
  plugin: p,
  marketplace: m,
  global: g,
}: {
  base: Base;
  installation: Pick<Installation, "updateGitignore">;
  plugin: Plugin;
  marketplace: Marketplace;
  global: Global;
}) {
  const { fs, manifestRepo, prompter } = base;
  const { resolveMarketplaceUseCase } = base;
  const { pluginInstallFromMarketplaceUseCase, pickPlugins } = p;
  const choosePlugins = new ChoosePlugins({
    pickPlugins,
    pluginInstallFromMarketplaceUseCase,
    listMarketplaces: base.listMarketplaces,
    resolveMarketplaceUseCase,
  });
  const chooseTools = new ChooseTools(prompter, base.tools);
  const runSetup = new RunSetup(
    new PrepareSetupProject(
      g.projectContextDetector,
      m.resolveSetupSource,
      new InitProject({ fs, manifestRepo, updateGitignore: inst.updateGitignore }, base.tools),
      m.registerSetupSource
    ),
    new InstallSetupTools(g.setupToolsUseCase, chooseTools, base.currentVersion),
    choosePlugins,
    m.syncSettingsUseCase,
    g.setupMachineScope
  );
  return { choosePlugins, chooseTools, runSetup };
}
