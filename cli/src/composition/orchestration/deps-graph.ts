import { homedir } from "node:os";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { Deps, FactoryOptions } from "../../orchestration/deps.js";
import type { Output } from "../../orchestration/domain/output.js";
import { type Container, createContainer } from "../container.js";
import { createFrameworkBuildUseCase } from "../translate.js";

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

type ContextName = Exclude<keyof Container, "menu">;
type OwnerOf<Member> = {
  [Context in ContextName]: Member extends keyof Container[Context] ? Context : never;
}[ContextName];

/** The members of the graph read straight off the context that wires them. */
type Passthrough = Exclude<keyof Graph, "homedir" | "telemetry" | "frameworkBuild">;

/** The context that wires each member. A member its context does not carry fails to compile. */
const OWNER: { [Member in Passthrough]: OwnerOf<Member> } = {
  setAgentModels: "agentModels",
  resetAgentModels: "agentModels",
  cleanUseCase: "clean",
  cleanUserScopeUseCase: "clean",
  uninstallTools: "clean",
  doctorAllUseCase: "doctor",
  doctorUseCase: "doctor",
  runUserScopeDoctor: "doctor",
  installAiToolUseCase: "global",
  installIdeToolUseCase: "global",
  runSync: "global",
  runUserScopeSync: "global",
  statusAllUseCase: "global",
  statusUseCase: "global",
  updateToolsUseCase: "global",
  assetProvider: "installation",
  listInstalledRulesUseCase: "installation",
  pluginListUseCase: "installation",
  addMarketplace: "marketplace",
  askMarketplaceSource: "marketplace",
  listMarketplaceCatalogs: "marketplace",
  refreshMarketplace: "marketplace",
  marketplaceCheckUseCase: "marketplace",
  marketplaceRemoveUseCase: "marketplace",
  syncNativeActivation: "marketplace",
  syncSettingsUseCase: "marketplace",
  userMarketplaceRemoveUseCase: "marketplace",
  pluginInstallUseCase: "plugin",
  pluginRemoveUseCase: "plugin",
  pluginUpdateUseCase: "plugin",
  searchPlugins: "plugin",
  userPluginRemove: "plugin",
  userPluginUpdateUseCase: "plugin",
  validateRecipes: "recipes",
  choosePlugins: "setup",
  runSetup: "setup",
  checkStatus: "shared",
  currentVersion: "shared",
  environment: "shared",
  fs: "shared",
  listMarketplaces: "shared",
  logIn: "shared",
  logOut: "shared",
  logger: "shared",
  manifestRepo: "shared",
  prompter: "shared",
  registerFrameworkMarketplace: "shared",
  userManifestRepo: "shared",
  userSourceReferences: "shared",
  printUpdateNotice: "update",
  refreshUpdateCheck: "update",
  selfUpdate: "update",
};

const lazy = (read: () => unknown): PropertyDescriptor => ({ get: read });

/** The members a command reads, each one wired by its context the first time it is read. */
function graphOf(container: Container, tools: ToolCatalog): Graph {
  const passthrough = Object.entries(OWNER).map(([member, context]) => [
    member,
    lazy(() => Reflect.get(container[context], member)),
  ]);
  return Object.defineProperties(Object.create(Object.prototype), {
    ...Object.fromEntries(passthrough),
    homedir: lazy(() => homedir),
    telemetry: lazy(() => container.telemetry),
    frameworkBuild: lazy(() => frameworkBuildOf(container, tools)),
  });
}

function frameworkBuildOf(container: Container, tools: ToolCatalog): Deps["frameworkBuild"] {
  const { fs, logger } = container.shared;
  const { assetProvider } = container.installation;
  return (ctx) => createFrameworkBuildUseCase(tools, { fs, assetProvider, logger }, ctx);
}

/** The factory those commands receive: each call builds one container, and a member wires its
 * context when the command first reads it. */
export function bindContainer(tools: ToolCatalog) {
  return async (
    projectRoot: string,
    options: FactoryOptions,
    output: Output | undefined
  ): Promise<Graph> => graphOf(createContainer({ projectRoot, ...options, output, tools }), tools);
}
