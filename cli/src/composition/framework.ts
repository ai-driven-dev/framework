import { homedir } from "node:os";
import { ManifestRepositoryAdapter } from "../contexts/installation/infrastructure/manifest-repository-adapter.js";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import type { Deps, DepsFactory, FactoryOptions, MenuDeps } from "../presentation/deps.js";
import type { CLIOutput } from "../presentation/output.js";
import {
  InquirerPrompterAdapter,
  SilentPrompterAdapter,
} from "../presentation/terminal/prompter-adapter.js";
import { wireBase } from "./framework/base.js";
import { wireClean } from "./framework/clean.js";
import { wireDoctor } from "./framework/doctor.js";
import { wireGlobal } from "./framework/global.js";
import { wireInstallation } from "./framework/installation.js";
import { wireMarketplace } from "./framework/marketplace.js";
import { wirePlugin } from "./framework/plugin.js";
import { wireSetup } from "./framework/setup.js";
import { wireRecipes } from "./recipes.js";
import { wireTelemetry } from "./telemetry.js";
import { createFrameworkBuildUseCase } from "./translate.js";
import { wireUpdate } from "./update.js";

/** One graph per catalog, then per project root and token: two catalogs never share a graph. */
const _cache = new WeakMap<ToolCatalog, Map<string, Deps>>();

export function createMenuDeps(projectRoot: string, tools: ToolCatalog): MenuDeps {
  return {
    manifestRepo: new ManifestRepositoryAdapter(projectRoot, (raw) => tools.toolId(raw)),
    prompter: process.stdout.isTTY ? new InquirerPrompterAdapter() : new SilentPrompterAdapter(),
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
  const base = wireBase(projectRoot, options, output, tools);
  const inst = wireInstallation(base);
  const marketplace = wireMarketplace(base, inst);
  const plugin = wirePlugin(base, inst);
  const global = wireGlobal(base, inst, marketplace, plugin);
  const setup = wireSetup(base, plugin, marketplace, global);
  const doctor = wireDoctor(base, inst);
  const clean = wireClean(base, inst);
  const {
    fs,
    logger,
    http,
    environment,
    tokenProvider,
    currentVersionProvider,
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
  } = base;
  const update = wireUpdate({
    logger,
    http,
    fs,
    environment,
    tokenProvider,
    version: currentVersionProvider,
  });
  const { pluginListUseCase, assetProvider, listInstalledRulesUseCase } = inst;
  const {
    addMarketplace,
    marketplaceRemoveUseCase,
    userMarketplaceRemoveUseCase,
    marketplaceCheckUseCase,
    marketplaceSyncSettingsUseCase,
    askMarketplaceSource,
  } = marketplace;
  const {
    pluginRemoveUseCase,
    pluginUpdateUseCase,
    userPluginUpdateUseCase,
    searchPlugins,
    pluginInstallUseCase,
  } = plugin;
  const {
    installAiToolUseCase,
    installIdeToolUseCase,
    statusUseCase,
    restoreUseCase,
    statusAllUseCase,
    restoreAllUseCase,
    updateToolsUseCase,
  } = global;
  const { setupPluginsPromptUseCase, runSetup } = setup;
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
    marketplaceSyncSettingsUseCase,
    doctorUseCase,
    doctorRegistrationUseCase,
    askMarketplaceSource,
    setupPluginsPromptUseCase,
    runSetup,
    selfUpdate: update.selfUpdate,
    statusUseCase,
    restoreUseCase,
    statusAllUseCase,
    restoreAllUseCase,
    updateToolsUseCase,
    cleanUseCase,
    cleanUserScopeUseCase,
    doctorAllUseCase,
    listInstalledRulesUseCase,
    printUpdateNotice: update.printUpdateNotice,
    refreshUpdateCheck: update.refreshUpdateCheck,
    telemetry: wireTelemetry(homedir),
    frameworkBuild: (ctx) => createFrameworkBuildUseCase(tools, { fs, assetProvider, logger }, ctx),
  };
  graphs.set(cacheKey, deps);
  return deps;
}
