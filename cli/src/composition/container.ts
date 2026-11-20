import { homedir } from "node:os";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import { BuildMenu } from "../orchestration/menu/build-menu.js";
import { MenuLoop } from "../orchestration/menu/menu-loop.js";
import type { CommandRunner, Pause } from "../orchestration/menu/menu-ports.js";
import type { Deps, FactoryOptions, MenuDeps } from "../presentation/deps.js";
import type { CLIOutput } from "../presentation/output.js";
import { projectSetupOf, wireInstallation } from "./installation.js";
import { wireClean } from "./orchestration/clean.js";
import { wireDoctor } from "./orchestration/doctor.js";
import { wireGlobal } from "./orchestration/global.js";
import { wireMarketplace } from "./orchestration/marketplace.js";
import { wirePlugin } from "./orchestration/plugin.js";
import { wireAgentModels, wireSetup } from "./orchestration/setup.js";
import { wireRecipes } from "./recipes.js";
import { currentVersion, wireBase } from "./shared.js";
import { wireTelemetry } from "./telemetry.js";
import { createFrameworkBuildUseCase } from "./translate.js";
import { wireUpdate } from "./update.js";

/** What a container is built from: where it runs, how it logs and the catalog its wiring reads. */
export interface ContainerOptions extends FactoryOptions {
  projectRoot: string;
  output?: CLIOutput;
  tools: ToolCatalog;
}

/** Each context's wiring is built the first time it is read, then handed back unchanged. */
function memoized<T extends object>(build: () => T): () => T {
  let built: T | undefined;
  return () => (built ??= build());
}

/** The wiring of one project root and token. Every context is a getter that builds it on first
 * read, so a command pays only for the contexts it reads and two containers share nothing. */
export function createContainer(options: ContainerOptions) {
  const { projectRoot, verbose, token, output, tools } = options;
  const shared = memoized(() => ({
    ...wireBase(projectRoot, { verbose, token }, output, tools),
    version: currentVersion(),
  }));
  const installation = memoized(() => wireInstallation(shared()));
  const update = memoized(() => {
    const { logger, http, fs, environment, tokenProvider, currentVersionProvider } = shared();
    return wireUpdate({
      logger,
      http,
      fs,
      environment,
      tokenProvider,
      version: currentVersionProvider,
    });
  });
  const marketplace = memoized(() => wireMarketplace(shared(), installation()));
  const plugin = memoized(() => wirePlugin(shared(), installation()));
  const global = memoized(() => wireGlobal(shared(), installation(), marketplace(), plugin()));
  const setup = memoized(() =>
    wireSetup(shared(), installation(), plugin(), marketplace(), global())
  );
  const doctor = memoized(() => wireDoctor(shared(), installation()));
  const clean = memoized(() => wireClean(shared(), installation()));
  const recipes = memoized(() => wireRecipes());
  const telemetry = memoized(() => wireTelemetry(homedir, shared().prompter));
  const agentModels = memoized(() => ({
    setAgentModels: wireAgentModels(shared(), installation(), plugin(), marketplace()),
  }));
  return {
    get shared() {
      return shared();
    },
    get installation() {
      return installation();
    },
    get update() {
      return update();
    },
    get marketplace() {
      return marketplace();
    },
    get plugin() {
      return plugin();
    },
    get global() {
      return global();
    },
    get setup() {
      return setup();
    },
    get agentModels() {
      return agentModels();
    },
    get doctor() {
      return doctor();
    },
    get clean() {
      return clean();
    },
    get telemetry() {
      return telemetry();
    },
    get recipes() {
      return recipes();
    },
    /** The menu loop of this project, given the terminal the loop runs commands on. */
    menu(terminal: { runner: CommandRunner; pause: Pause }): MenuDeps {
      const { prompter, manifestRepo } = shared();
      const menu = new BuildMenu(projectSetupOf(manifestRepo), prompter, tools);
      return { menuLoop: new MenuLoop(menu, terminal.runner, terminal.pause), prompter };
    },
  };
}

/** The factory those commands receive: each call builds one container, and a member wires its
 * context when the command first reads it. */
export function bindContainer(tools: ToolCatalog) {
  return async (
    projectRoot: string,
    options: FactoryOptions,
    output: CLIOutput | undefined
  ): Promise<Deps> => {
    const container = createContainer({ projectRoot, ...options, output, tools });
    return {
      get selfUpdate() {
        return container.update.selfUpdate;
      },
      get printUpdateNotice() {
        return container.update.printUpdateNotice;
      },
      get refreshUpdateCheck() {
        return container.update.refreshUpdateCheck;
      },
      get logger() {
        return container.shared.logger;
      },
      get prompter() {
        return container.shared.prompter;
      },
      get logIn() {
        return container.shared.logIn;
      },
      get logOut() {
        return container.shared.logOut;
      },
      get checkStatus() {
        return container.shared.checkStatus;
      },
      get fs() {
        return container.shared.fs;
      },
      get userSourceReferences() {
        return container.shared.userSourceReferences;
      },
      get assetProvider() {
        return container.installation.assetProvider;
      },
      get registerFrameworkMarketplace() {
        return container.shared.registerFrameworkMarketplace;
      },
      get askMarketplaceSource() {
        return container.marketplace.askMarketplaceSource;
      },
      get choosePlugins() {
        return container.setup.choosePlugins;
      },
      get userManifestRepo() {
        return container.shared.userManifestRepo;
      },
      get restoreAllUseCase() {
        return container.global.restoreAllUseCase;
      },
      get restoreToolUseCase() {
        return container.global.restoreToolUseCase;
      },
      get syncSettingsUseCase() {
        return container.marketplace.syncSettingsUseCase;
      },
      get syncNativeActivation() {
        return container.marketplace.syncNativeActivation;
      },
      get runSetup() {
        return container.setup.runSetup;
      },
      get setAgentModels() {
        return container.agentModels.setAgentModels;
      },
      get pluginRemoveUseCase() {
        return container.plugin.pluginRemoveUseCase;
      },
      get userPluginRemove() {
        return container.plugin.userPluginRemove;
      },
      get pluginListUseCase() {
        return container.installation.pluginListUseCase;
      },
      get pluginInstallUseCase() {
        return container.plugin.pluginInstallUseCase;
      },
      get searchPlugins() {
        return container.plugin.searchPlugins;
      },
      get userPluginUpdateUseCase() {
        return container.plugin.userPluginUpdateUseCase;
      },
      get pluginUpdateUseCase() {
        return container.plugin.pluginUpdateUseCase;
      },
      get addMarketplace() {
        return container.marketplace.addMarketplace;
      },
      get listMarketplaces() {
        return container.shared.listMarketplaces;
      },
      get userMarketplaceRemoveUseCase() {
        return container.marketplace.userMarketplaceRemoveUseCase;
      },
      get marketplaceRemoveUseCase() {
        return container.marketplace.marketplaceRemoveUseCase;
      },
      get refreshMarketplace() {
        return container.shared.refreshMarketplace;
      },
      get marketplaceCheckUseCase() {
        return container.marketplace.marketplaceCheckUseCase;
      },
      get doctorAllUseCase() {
        return container.doctor.doctorAllUseCase;
      },
      get statusAllUseCase() {
        return container.global.statusAllUseCase;
      },
      get doctorUseCase() {
        return container.doctor.doctorUseCase;
      },
      get statusUseCase() {
        return container.global.statusUseCase;
      },
      get homedir() {
        return homedir;
      },
      get environment() {
        return container.shared.environment;
      },
      get doctorRegistrationUseCase() {
        return container.doctor.doctorRegistrationUseCase;
      },
      get cleanUseCase() {
        return container.clean.cleanUseCase;
      },
      get cleanUserScopeUseCase() {
        return container.clean.cleanUserScopeUseCase;
      },
      get currentVersionProvider() {
        return container.shared.currentVersionProvider;
      },
      get installAiToolUseCase() {
        return container.global.installAiToolUseCase;
      },
      get manifestRepo() {
        return container.shared.manifestRepo;
      },
      get installIdeToolUseCase() {
        return container.global.installIdeToolUseCase;
      },
      get uninstallTools() {
        return container.clean.uninstallTools;
      },
      get updateToolsUseCase() {
        return container.global.updateToolsUseCase;
      },
      get listInstalledRulesUseCase() {
        return container.installation.listInstalledRulesUseCase;
      },
      get validateRecipes() {
        return container.recipes.validateRecipes;
      },
      get telemetry() {
        return container.telemetry;
      },
      get frameworkBuild() {
        const { fs, logger } = container.shared;
        const { assetProvider } = container.installation;
        const build: Deps["frameworkBuild"] = (ctx) =>
          createFrameworkBuildUseCase(tools, { fs, assetProvider, logger }, ctx);
        return build;
      },
    };
  };
}
