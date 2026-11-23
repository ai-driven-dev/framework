import type { Deps, FactoryOptions } from "../../orchestration/deps.js";
import type { Output } from "../../orchestration/domain/output.js";
import { type Container, createContainer } from "../container.js";
import type { RegisteredCatalog } from "../contexts/tools.js";
import { createFrameworkBuildUseCase } from "../contexts/translate.js";

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
type Passthrough = Exclude<keyof Graph, "telemetry" | "frameworkBuild">;

/** The context that wires each member. A member its context does not carry fails to compile. */
const OWNER: { [Member in Passthrough]: OwnerOf<Member> } = {
  setAgentModels: "agentModels",
  resetAgentModels: "agentModels",
  cleanProject: "clean",
  cleanUserScope: "clean",
  uninstallTools: "clean",
  doctorAll: "doctor",
  runDoctor: "doctor",
  runUserScopeDoctor: "doctor",
  userSettingsFileOf: "doctor",
  installAiToolWithPlugins: "global",
  installIdeTool: "global",
  runSync: "global",
  runUserScopeSync: "global",
  reportAllStatus: "global",
  reportStatus: "global",
  updateTools: "global",
  assetProvider: "installation",
  listInstalledRules: "installation",
  listPlugins: "installation",
  addMarketplace: "marketplace",
  askMarketplaceSource: "marketplace",
  listMarketplaceCatalogs: "marketplace",
  refreshMarketplace: "marketplace",
  checkMarketplaceUpstream: "marketplace",
  removeProjectMarketplace: "marketplace",
  syncNativeActivation: "marketplace",
  syncSettings: "marketplace",
  removeUserMarketplace: "marketplace",
  installPlugin: "plugin",
  removePlugin: "plugin",
  updatePlugin: "plugin",
  searchPlugins: "plugin",
  userPluginRemove: "plugin",
  updateUserPlugin: "plugin",
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
function graphOf(container: Container, tools: RegisteredCatalog): Graph {
  const passthrough = Object.entries(OWNER).map(([member, context]) => [
    member,
    lazy(() => Reflect.get(container[context], member)),
  ]);
  return Object.defineProperties(Object.create(Object.prototype), {
    ...Object.fromEntries(passthrough),
    telemetry: lazy(() => container.telemetry),
    frameworkBuild: lazy(() => frameworkBuildOf(container, tools)),
  });
}

function frameworkBuildOf(container: Container, tools: RegisteredCatalog): Deps["frameworkBuild"] {
  const { fs, logger } = container.shared;
  const { assetProvider } = container.installation;
  return (ctx) => createFrameworkBuildUseCase(tools, { fs, assetProvider, logger }, ctx);
}

/** The factory those commands receive: each call builds one container, and a member wires its
 * context when the command first reads it. */
export function bindContainer(tools: RegisteredCatalog) {
  return async (
    projectRoot: string,
    options: FactoryOptions,
    output: Output | undefined
  ): Promise<Graph> => graphOf(createContainer({ projectRoot, ...options, output, tools }), tools);
}
