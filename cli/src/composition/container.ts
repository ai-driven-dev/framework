import { homedir } from "node:os";
import { ManifestRepositoryAdapter } from "../contexts/installation/infrastructure/manifest-repository-adapter.js";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import { BuildMenu } from "../orchestration/menu/build-menu.js";
import { MenuLoop } from "../orchestration/menu/menu-loop.js";
import type { CommandRunner, Pause } from "../orchestration/menu/menu-ports.js";
import type { Deps, DepsFactory, FactoryOptions, MenuDeps } from "../presentation/deps.js";
import type { CLIOutput } from "../presentation/output.js";
import {
  InquirerPrompterAdapter,
  SilentPrompterAdapter,
} from "../presentation/terminal/prompter-adapter.js";
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

/** One graph per catalog, then per project root and token: two catalogs never share a graph. */
const _cache = new WeakMap<ToolCatalog, Map<string, Deps>>();

/** The menu loop and the prompter of a project, given the terminal the loop runs commands on. */
export function createMenuDeps(
  projectRoot: string,
  tools: ToolCatalog,
  terminal: { runner: CommandRunner; pause: Pause }
): MenuDeps {
  const prompter = process.stdout.isTTY
    ? new InquirerPrompterAdapter()
    : new SilentPrompterAdapter();
  const projectSetup = projectSetupOf(
    new ManifestRepositoryAdapter(projectRoot, (raw) => tools.toolId(raw))
  );
  const menu = new BuildMenu(projectSetup, prompter, tools);
  return { menuLoop: new MenuLoop(menu, terminal.runner, terminal.pause), prompter };
}

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
  };
}

/** The factory the commands receive: it binds the catalog the commands were registered with. */
export function bindCatalog(tools: ToolCatalog): DepsFactory {
  return (projectRoot, options, output) => createDeps(projectRoot, options, output, tools);
}

export async function createDeps(
  projectRoot: string,
  options: FactoryOptions,
  output: CLIOutput | undefined,
  tools: ToolCatalog
): Promise<Deps> {
  const cacheKey = `${projectRoot}\u0000${options.token ?? ""}`;
  const graphs = _cache.get(tools) ?? new Map<string, Deps>();
  _cache.set(tools, graphs);
  const cached = graphs.get(cacheKey);
  if (cached !== undefined) return cached;
  const container = createContainer({ projectRoot, ...options, output, tools });
  const base = container.shared;
  const inst = container.installation;
  const marketplace = wireMarketplace(base, inst);
  const plugin = wirePlugin(base, inst);
  const global = wireGlobal(base, inst, marketplace, plugin);
  const setup = wireSetup(base, inst, plugin, marketplace, global);
  const doctor = wireDoctor(base, inst);
  const clean = wireClean(base, inst);
  const setAgentModels = wireAgentModels(base, inst, plugin, marketplace);
  const {
    fs,
    logger,
    manifestRepo,
    userManifestRepo,
    prompter,
    logIn,
    logOut,
    checkStatus,
    userSourceReferences,
    listMarketplaces,
    refreshMarketplace,
    registerFrameworkMarketplace,
    currentVersionProvider,
    environment,
  } = base;
  const update = container.update;
  const { pluginListUseCase, assetProvider, listInstalledRulesUseCase } = inst;
  const {
    addMarketplace,
    marketplaceRemoveUseCase,
    userMarketplaceRemoveUseCase,
    marketplaceCheckUseCase,
    syncSettingsUseCase,
    syncNativeActivation,
    askMarketplaceSource,
  } = marketplace;
  const {
    pluginRemoveUseCase,
    userPluginRemove,
    pluginUpdateUseCase,
    userPluginUpdateUseCase,
    searchPlugins,
    pluginInstallUseCase,
  } = plugin;
  const {
    installAiToolUseCase,
    installIdeToolUseCase,
    statusUseCase,
    restoreToolUseCase,
    statusAllUseCase,
    restoreAllUseCase,
    updateToolsUseCase,
  } = global;
  const { choosePlugins, runSetup } = setup;
  const { doctorUseCase, doctorRegistrationUseCase, doctorAllUseCase } = doctor;
  const { uninstallTools, cleanUseCase, cleanUserScopeUseCase } = clean;
  const deps: Deps = {
    validateRecipes: wireRecipes().validateRecipes,
    fs,
    manifestRepo,
    userManifestRepo,
    homedir,
    environment,
    logger,
    currentVersionProvider,
    prompter,
    logIn,
    logOut,
    checkStatus,
    pluginRemoveUseCase,
    userPluginRemove,
    pluginListUseCase,
    pluginUpdateUseCase,
    userPluginUpdateUseCase,
    addMarketplace,
    listMarketplaces,
    marketplaceRemoveUseCase,
    userMarketplaceRemoveUseCase,
    refreshMarketplace,
    marketplaceCheckUseCase,
    userSourceReferences,
    installAiToolUseCase,
    installIdeToolUseCase,
    uninstallTools,
    assetProvider,
    searchPlugins,
    registerFrameworkMarketplace,
    pluginInstallUseCase,
    syncSettingsUseCase,
    syncNativeActivation,
    doctorUseCase,
    doctorRegistrationUseCase,
    askMarketplaceSource,
    choosePlugins,
    runSetup,
    setAgentModels,
    selfUpdate: update.selfUpdate,
    statusUseCase,
    restoreToolUseCase,
    statusAllUseCase,
    restoreAllUseCase,
    updateToolsUseCase,
    cleanUseCase,
    cleanUserScopeUseCase,
    doctorAllUseCase,
    listInstalledRulesUseCase,
    printUpdateNotice: update.printUpdateNotice,
    refreshUpdateCheck: update.refreshUpdateCheck,
    telemetry: wireTelemetry(homedir, prompter),
    frameworkBuild: (ctx) => createFrameworkBuildUseCase(tools, { fs, assetProvider, logger }, ctx),
  };
  graphs.set(cacheKey, deps);
  return deps;
}
