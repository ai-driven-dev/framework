import { homedir } from "node:os";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import { BuildMenu } from "../orchestration/menu/build-menu.js";
import { MenuLoop } from "../orchestration/menu/menu-loop.js";
import type { CommandRunner, Pause } from "../orchestration/menu/menu-ports.js";
import type { Deps, FactoryOptions, Output } from "../presentation/deps.js";
import { projectSetupOf, wireInstallation } from "./installation.js";
import { wireClean } from "./orchestration/clean.js";
import { wireDoctor } from "./orchestration/doctor.js";
import { wireGlobal } from "./orchestration/global.js";
import { wireMarketplace } from "./orchestration/marketplace.js";
import { wirePlugin } from "./orchestration/plugin.js";
import { wireAgentModels, wireSetup } from "./orchestration/setup.js";
import { wireRecipes } from "./recipes.js";
import { type BaseOptions, currentVersion, wireBase } from "./shared.js";
import { wireTelemetry } from "./telemetry.js";
import { createFrameworkBuildUseCase } from "./translate.js";
import { wireUpdate } from "./update.js";

/** Each context's wiring is built the first time it is read, then handed back unchanged. */
function memoized<T extends object>(build: () => T): () => T {
  let built: T | undefined;
  return () => (built ??= build());
}

/** The wirings the others build on: the shared adapters, installation, and the marketplace and
 * plugin areas. */
function foundationOf({ projectRoot, verbose, token, output, tools }: BaseOptions) {
  const shared = memoized(() => ({
    ...wireBase({ projectRoot, verbose, token, output, tools }),
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
  return { shared, installation, update, marketplace, plugin };
}

type Foundation = ReturnType<typeof foundationOf>;

/** The wirings of the scenarios a command runs, built over the foundation. */
function scenariosOf({ shared, installation, marketplace, plugin }: Foundation) {
  const global = memoized(() =>
    wireGlobal({
      base: shared(),
      installation: installation(),
      marketplace: marketplace(),
      plugin: plugin(),
    })
  );
  const setup = memoized(() =>
    wireSetup({
      base: shared(),
      installation: installation(),
      plugin: plugin(),
      marketplace: marketplace(),
      global: global(),
    })
  );
  const agentModels = memoized(() => ({
    setAgentModels: wireAgentModels({
      base: shared(),
      installation: installation(),
      plugin: plugin(),
      marketplace: marketplace(),
    }),
  }));
  const doctor = memoized(() => wireDoctor(shared(), installation()));
  const clean = memoized(() => wireClean(shared(), installation()));
  const recipes = memoized(() => wireRecipes());
  const telemetry = memoized(() => wireTelemetry(homedir, shared().prompter));
  return { global, setup, agentModels, doctor, clean, recipes, telemetry };
}

/** The wiring of one project root and token. Every context is a getter that builds it on first
 * read, so a command pays only for the contexts it reads and two containers share nothing. */
export function createContainer(options: BaseOptions) {
  const base = foundationOf(options);
  const scenarios = scenariosOf(base);
  const { shared, installation, update, marketplace, plugin } = base;
  const { global, setup, agentModels, doctor, clean, recipes, telemetry } = scenarios;
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
    menu(terminal: { runner: CommandRunner; pause: Pause }): MenuLoop {
      const { prompter, manifestRepo } = shared();
      const menu = new BuildMenu(projectSetupOf(manifestRepo), prompter, options.tools);
      return new MenuLoop(menu, terminal.runner, terminal.pause);
    },
  };
}

type Container = ReturnType<typeof createContainer>;

/** What the composition hands out: the members a command reads, plus the ones only wiring and
 * its tests read, which the presentation's `Deps` leaves out. */
export type Graph = Deps &
  Pick<
    Container["shared"],
    | "fs"
    | "manifestRepo"
    | "userManifestRepo"
    | "userSourceReferences"
    | "registerFrameworkMarketplace"
  > &
  Pick<Container["installation"], "assetProvider"> &
  Pick<Container["marketplace"], "askMarketplaceSource"> &
  Pick<Container["setup"], "choosePlugins">;

/** The members a command reads, each one wired by its context the first time it is read. */
class ContainerGraph implements Graph {
  constructor(
    private readonly container: Container,
    private readonly tools: ToolCatalog
  ) {}

  get selfUpdate() {
    return this.container.update.selfUpdate;
  }
  get printUpdateNotice() {
    return this.container.update.printUpdateNotice;
  }
  get refreshUpdateCheck() {
    return this.container.update.refreshUpdateCheck;
  }
  get logger() {
    return this.container.shared.logger;
  }
  get prompter() {
    return this.container.shared.prompter;
  }
  get logIn() {
    return this.container.shared.logIn;
  }
  get logOut() {
    return this.container.shared.logOut;
  }
  get checkStatus() {
    return this.container.shared.checkStatus;
  }
  get manifestRepo() {
    return this.container.shared.manifestRepo;
  }
  get userManifestRepo() {
    return this.container.shared.userManifestRepo;
  }
  get fs() {
    return this.container.shared.fs;
  }
  get userSourceReferences() {
    return this.container.shared.userSourceReferences;
  }
  get assetProvider() {
    return this.container.installation.assetProvider;
  }
  get registerFrameworkMarketplace() {
    return this.container.shared.registerFrameworkMarketplace;
  }
  get askMarketplaceSource() {
    return this.container.marketplace.askMarketplaceSource;
  }
  get choosePlugins() {
    return this.container.setup.choosePlugins;
  }
  get readMachineInstallation() {
    return this.container.installation.readMachineInstallation;
  }
  get restoreAllUseCase() {
    return this.container.global.restoreAllUseCase;
  }
  get restoreToolUseCase() {
    return this.container.global.restoreToolUseCase;
  }
  get syncSettingsUseCase() {
    return this.container.marketplace.syncSettingsUseCase;
  }
  get syncNativeActivation() {
    return this.container.marketplace.syncNativeActivation;
  }
  get runSetup() {
    return this.container.setup.runSetup;
  }
  get setAgentModels() {
    return this.container.agentModels.setAgentModels;
  }
  get pluginRemoveUseCase() {
    return this.container.plugin.pluginRemoveUseCase;
  }
  get userPluginRemove() {
    return this.container.plugin.userPluginRemove;
  }
  get pluginListUseCase() {
    return this.container.installation.pluginListUseCase;
  }
  get pluginInstallUseCase() {
    return this.container.plugin.pluginInstallUseCase;
  }
  get searchPlugins() {
    return this.container.plugin.searchPlugins;
  }
  get userPluginUpdateUseCase() {
    return this.container.plugin.userPluginUpdateUseCase;
  }
  get pluginUpdateUseCase() {
    return this.container.plugin.pluginUpdateUseCase;
  }
  get addMarketplace() {
    return this.container.marketplace.addMarketplace;
  }
  get listMarketplaces() {
    return this.container.shared.listMarketplaces;
  }
  get userMarketplaceRemoveUseCase() {
    return this.container.marketplace.userMarketplaceRemoveUseCase;
  }
  get marketplaceRemoveUseCase() {
    return this.container.marketplace.marketplaceRemoveUseCase;
  }
  get refreshMarketplace() {
    return this.container.shared.refreshMarketplace;
  }
  get marketplaceCheckUseCase() {
    return this.container.marketplace.marketplaceCheckUseCase;
  }
  get doctorAllUseCase() {
    return this.container.doctor.doctorAllUseCase;
  }
  get statusAllUseCase() {
    return this.container.global.statusAllUseCase;
  }
  get doctorUseCase() {
    return this.container.doctor.doctorUseCase;
  }
  get statusUseCase() {
    return this.container.global.statusUseCase;
  }
  get homedir() {
    return homedir;
  }
  get environment() {
    return this.container.shared.environment;
  }
  get doctorRegistrationUseCase() {
    return this.container.doctor.doctorRegistrationUseCase;
  }
  get cleanUseCase() {
    return this.container.clean.cleanUseCase;
  }
  get cleanUserScopeUseCase() {
    return this.container.clean.cleanUserScopeUseCase;
  }
  get currentVersionProvider() {
    return this.container.shared.currentVersionProvider;
  }
  get installAiToolUseCase() {
    return this.container.global.installAiToolUseCase;
  }
  get installIdeToolUseCase() {
    return this.container.global.installIdeToolUseCase;
  }
  get uninstallTools() {
    return this.container.clean.uninstallTools;
  }
  get updateToolsUseCase() {
    return this.container.global.updateToolsUseCase;
  }
  get listInstalledRulesUseCase() {
    return this.container.installation.listInstalledRulesUseCase;
  }
  get validateRecipes() {
    return this.container.recipes.validateRecipes;
  }
  get telemetry() {
    return this.container.telemetry;
  }
  get frameworkBuild() {
    const { fs, logger } = this.container.shared;
    const { assetProvider } = this.container.installation;
    const build: Deps["frameworkBuild"] = (ctx) =>
      createFrameworkBuildUseCase(this.tools, { fs, assetProvider, logger }, ctx);
    return build;
  }
}

/** The factory those commands receive: each call builds one container, and a member wires its
 * context when the command first reads it. */
export function bindContainer(tools: ToolCatalog) {
  return async (
    projectRoot: string,
    options: FactoryOptions,
    output: Output | undefined
  ): Promise<Graph> =>
    new ContainerGraph(createContainer({ projectRoot, ...options, output, tools }), tools);
}
