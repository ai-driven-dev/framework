import { resolve } from "node:path";
import { type Command, Option } from "commander";
import {
  type FrameworkSource,
  localFrameworkSource,
  remoteFrameworkSource,
} from "../../contexts/distribution/contract/framework-source.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { AiToolProfile, ToolProfile } from "../../contexts/tools/contract/tool-profile.js";
import type { SetAgentModels } from "../../orchestration/agent-models/set-agent-models.js";
import { SetupFlow } from "../../orchestration/setup/setup-flow.js";
import { CategoryMismatchError } from "../../shared/domain/errors.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { DepsSliceFactory } from "../deps.js";
import {
  printDetectedContext,
  printNextSteps,
  printSetupOutcome,
  printWelcomeBanner,
} from "../display/setup-display.js";
import { reportNativeActivation } from "../display/sync-display.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { parseGlobalOptions, parseScopeFlag } from "./global-options.js";

/** What this command reads of the graph. */
type SetupKeys = "runSetup" | "setAgentModels";

/** Says, per host, what the main session and each agent now run on, where the main session's
 * model was written, which plugins were updated, and what other projects still need. */
function reportAgentModels(
  output: CLIOutput,
  catalog: ToolCatalog,
  provider: string | undefined,
  hosts: readonly AiToolId[],
  main: Awaited<ReturnType<SetAgentModels["execute"]>>
): void {
  if (provider === undefined) {
    output.success(`${hosts.join(", ")}: the agents run on the IDE's model again.`);
    for (const { host, path } of main.changed)
      output.info(`  ${host} main session: restored in ${path}`);
  } else {
    output.success(`Models on ${provider}, for every project on this machine:`);
    for (const host of hosts) {
      const models = catalog.aiProfile(host).agentModels();
      if (models === null) continue;
      const skipped = main.skipped.some((entry) => entry.host === host);
      const written = main.changed.findLast((entry) => entry.host === host);
      const { model, effort } = models.mainModel(provider);
      const effortShown = effort === undefined ? "" : ` (${effort})`;
      if (!skipped) {
        output.info(
          written === undefined
            ? `  ${host} main session: not managed by aidd, still the IDE's choice`
            : `  ${host} main session: ${model}${effortShown}, written in ${written.path}`
        );
      }
      for (const group of models.roleModels(provider)) {
        output.info(`  ${host} ${group.roles.join(", ")}: ${group.model} (${group.effort})`);
      }
    }
  }
  for (const { host, path, reason } of main.skipped) {
    output.warn(`${host} main session left as it is in ${path}: ${reason}.`);
  }
  output.info(
    main.reinstalled.length > 0
      ? `Agents updated: ${main.reinstalled.join(", ")}.`
      : "Agents installed later get these models too."
  );
  output.info(
    `Other projects follow at their next install; to update the agents they already have, run \`aidd setup --ide ${hosts.join(",")} --provider ${provider ?? "none"}\` there.`
  );
}

/** The tools of this run that run the framework's agents, and the provider asked for, refused
 * before anything is built or written: one provider per run, so a tool that does not run it is
 * named. */
function agentModelsRequest(
  raw: string | undefined,
  aiTools: readonly string[],
  catalog: ToolCatalog
): { hosts: AiToolId[]; provider: string | undefined } {
  const runsAgents = (id: AiToolId) => catalog.aiProfile(id).agentModels() !== null;
  const hosts = aiTools.flatMap((raw) => {
    const id = catalog.aiToolId(raw);
    return id !== null && runsAgents(id) ? [id] : [];
  });
  const provider = raw === "none" ? undefined : raw;
  const known = catalog.agentProviders();
  if (provider !== undefined && !known.includes(provider)) {
    throw new Error(`Unknown provider "${provider}". Use: ${known.join(", ")}, or none.`);
  }
  if (raw !== undefined && hosts.length === 0) {
    const all = catalog.idsInCanonicalOrder("ai").filter(runsAgents);
    throw new Error(
      `--provider needs --ide with a tool that runs the framework's agents: ${all.join(", ")}.`
    );
  }
  if (provider !== undefined) {
    for (const host of hosts) catalog.aiProfile(host).agentModels()?.supportedProvider(provider);
  }
  return { hosts, provider };
}

interface SetupCmdOptions {
  source?: "remote" | "local";
  path?: string;
  release?: string;
  ai?: string;
  ide?: string;
  plugins?: string;
  yes?: boolean;
  defaultMarketplace?: boolean;
  scope?: string;
  global?: boolean;
  provider?: string;
}

export function parseSourceFlag(
  cmdOptions: SetupCmdOptions,
  output: CLIOutput
): FrameworkSource | undefined {
  if (!cmdOptions.source) return undefined;
  if (cmdOptions.source === "local") {
    if (!cmdOptions.path) {
      output.error("--source local requires --path <dir>");
      process.exit(1);
    }
    return localFrameworkSource(resolve(cmdOptions.path));
  }
  return remoteFrameworkSource(undefined, cmdOptions.release);
}

export function expandAllKeyword(raw: string | undefined, all: readonly string[]): string[] {
  if (raw === undefined) return [];
  if (raw.trim() === "all") return [...all];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `--ide` takes every tool, AI assistants and editors alike; `--ai`, its former spelling,
 * still takes AI tools alone. Each id lands in the list its category decides. */
export function parseToolIds(
  cmdOptions: SetupCmdOptions,
  errorHandler: ErrorHandler,
  tools: ToolCatalog
): { aiTools: string[]; ideTools: string[] } | null {
  const aiIds = expandAllKeyword(cmdOptions.ai, tools.idsInCanonicalOrder("ai"));
  const ids = expandAllKeyword(cmdOptions.ide, tools.idsInCanonicalOrder());
  try {
    if (aiIds.length > 0 && cmdOptions.ai?.trim() !== "all") assertAiToolIds(aiIds, tools);
  } catch (e) {
    errorHandler.handle(e);
    return null;
  }
  const unique = [...new Set([...aiIds, ...ids])];
  return {
    aiTools: unique.filter((id) => !tools.isIdeTool(id)),
    ideTools: unique.filter((id) => tools.isIdeTool(id)),
  };
}

function assertAiToolIds(toolIds: readonly string[], tools: ToolCatalog): void {
  const wrong = toolIds.filter((id) => !tools.isAiTool(id));
  if (wrong.length > 0) {
    throw new CategoryMismatchError(wrong, "ai", tools.idsInCanonicalOrder("ai"));
  }
}

type PluginsMode = "interactive" | "all" | "recommended" | "named" | "none";

export function parsePluginsFlag(
  raw: string | undefined,
  interactive: boolean
): { mode: PluginsMode; names: string[] } {
  if (raw === undefined) return { mode: interactive ? "interactive" : "none", names: [] };
  const value = raw.trim();
  if (value === "none") return { mode: "none", names: [] };
  if (value === "all") return { mode: "all", names: [] };
  if (value === "recommended") return { mode: "recommended", names: [] };
  const names = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { mode: "named", names };
}

function activatesAtUserScope(profile: ToolProfile): profile is AiToolProfile {
  return profile.kind === "ai" && profile.supportsUserScopeActivation();
}

/** What `--global` does for each registered tool, read from its profile. */
export function globalSetupHelp(catalog: ToolCatalog): string {
  const global = catalog.sortedById().filter(activatesAtUserScope);
  const tools = global.map((profile) => profile.toolId);
  const native = global.filter((profile) => profile.nativeActivation() !== undefined);
  const copying = global.filter((profile) => profile.plugins()?.copiesFilesGlobally());
  const where = (profile: AiToolProfile) =>
    profile.plugins()?.userPluginsBaseDir("~")?.replaceAll("\\", "/");
  return [
    "",
    "Global:",
    `  Pass --ide ${tools.join(",")} (one or more, no editor) and --plugins all, recommended, none or names.`,
    `  ${native.map((p) => p.toolId).join(", ")} enable the plugins through their own CLI, which must be on PATH.`,
    `  ${copying.map((p) => `${p.toolId} gets their files in ${where(p)}`).join(", ")}.`,
    "  `aidd sync --global` refreshes them from the framework source.",
  ].join("\n");
}

export function registerSetupCommand(
  program: Command,
  catalog: ToolCatalog,
  createDeps: DepsSliceFactory<SetupKeys>
): void {
  program
    .command("setup")
    .description(
      "Set up or update the project to a correct state — bootstraps the whole project (marketplace, framework, tools, plugins); see `framework install`, which acts on the framework alone"
    )
    .option("--source <mode>", "Framework source: remote or local")
    .option("--path <dir>", "Absolute path to local framework (required with --source local)")
    .option("--release <tag>", "Marketplace release tag to fetch (e.g., v1.2.3)")
    .option("--ide <ids>", "Comma-separated tool IDs, or 'all' (e.g., claude,vscode or all)")
    .addOption(new Option("--ai <ids>", "Former spelling of --ide, for AI tools").hideHelp())
    .option(
      "--plugins <mode>",
      "Plugin install mode: none | all | recommended | comma-separated names"
    )
    .option(
      "--no-default-marketplace",
      "Skip auto-registering aidd-framework (no source prompt, no plugin install)"
    )
    .option("--yes", "Accept defaults without prompting")
    .option(
      "--global",
      "install for every project on this machine instead of into this project; see the " +
        "requirements below"
    )
    .addOption(new Option("--scope <scope>", "Former spelling: user means --global").hideHelp())
    .option(
      "--provider <provider>",
      `Run each tool's main session and agents on this provider's model for their role (${catalog.agentProviders().join(", ")}), or none for the IDE's model`
    )
    .addHelpText("after", () => globalSetupHelp(catalog))
    .action(async (cmdOptions: SetupCmdOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      const source = parseSourceFlag(cmdOptions, output);
      const scope = cmdOptions.global === true ? "user" : parseScopeFlag(cmdOptions.scope, output);
      const toolIds = parseToolIds(cmdOptions, errorHandler, catalog);
      if (toolIds === null) return;

      const hasScriptingFlags = !!(
        cmdOptions.source ||
        cmdOptions.release ||
        cmdOptions.ai ||
        cmdOptions.ide ||
        cmdOptions.plugins ||
        cmdOptions.yes ||
        cmdOptions.global ||
        cmdOptions.provider
      );
      const interactive = process.stdout.isTTY && !hasScriptingFlags;

      const { mode: pluginMode, names: pluginNames } = parsePluginsFlag(
        cmdOptions.plugins,
        interactive
      );

      const registerDefaultMarketplace = cmdOptions.defaultMarketplace !== false;
      try {
        const flow = new SetupFlow({
          projectRoot,
          registeredToolIds: catalog.idsInCanonicalOrder(),
          aiToolIds: catalog.idsInCanonicalOrder("ai"),
          ideToolIds: catalog.idsInCanonicalOrder("ide"),
          supportsUserScopeActivation: (id) => activatesAtUserScope(catalog.profile(id)),
          source,
          aiTools: toolIds.aiTools,
          ideTools: toolIds.ideTools,
          pluginMode,
          pluginNames,
          interactive,
          force: false,
          registerDefaultMarketplace,
          scope,
        });

        const agents = agentModelsRequest(cmdOptions.provider, toolIds.aiTools, catalog);

        if (interactive) printWelcomeBanner(output);

        const deps = await createDeps(projectRoot, { verbose }, output);

        const result = await deps.runSetup.execute(flow);

        if (interactive && result.context !== undefined) {
          printDetectedContext(output, result.context.describe());
        }
        printSetupOutcome(output, result, verbose);
        // Once the install has succeeded: the provider and the main session's model hold for
        // every project on the machine, so a failed install leaves both as they were.
        if (cmdOptions.provider !== undefined) {
          const models = await deps.setAgentModels.execute({
            projectRoot,
            ...agents,
            scope: scope ?? "project",
          });
          reportAgentModels(output, catalog, agents.provider, agents.hosts, models);
        }
        if (interactive) printNextSteps(output, result.install.results.length > 0);
        reportNativeActivation(output, result.activation);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
