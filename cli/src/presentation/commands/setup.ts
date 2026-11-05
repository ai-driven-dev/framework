import { resolve } from "node:path";
import { type Command, Option } from "commander";
import { MarketplaceSourceMode } from "../../contexts/distribution/domain/marketplace-source-mode.js";
import { SetupUseCase } from "../../contexts/framework/application/setup-use-case.js";
import { SetupFlow } from "../../contexts/framework/domain/setup-flow.js";
import {
  AGENT_MODELS,
  type AgentHost,
  type AgentProvider,
  agentHostIds,
  agentProviders,
  isAgentHost,
  roleModels,
  supportedProvider,
  tierModel,
} from "../../contexts/tools/domain/formats/agent-models.js";
import {
  assertToolIdsMatchCategory,
  copiesPluginFilesGlobally,
  getAllRegisteredTools,
  nativeActivationOf,
  resolvePluginsCapability,
  supportsUserScopeActivation,
} from "../../contexts/tools/domain/registry.js";
import type { ToolId } from "../../kernel/tool.js";
import { AI_TOOL_IDS, IDE_TOOL_IDS } from "../../kernel/tool.js";
import { createDeps } from "../../runtime/wiring/framework.js";
import {
  printDetectedContext,
  printNextSteps,
  printSetupOutcome,
  printWelcomeBanner,
} from "../display/setup-display.js";
import { ErrorHandler } from "../error-handler.js";
import type { CLIOutput } from "../output.js";
import { parseGlobalOptions, parseScopeFlag } from "./global-options.js";
import { reportSyncActivation } from "./sync-native-activation.js";

/** Says, per host, what the main session and each agent now run on, where the main session's
 * model was written, which plugins were updated, and what other projects still need. */
function reportAgentModels(
  output: CLIOutput,
  provider: AgentProvider | undefined,
  hosts: readonly AgentHost[],
  main: {
    readonly reinstalled: readonly string[];
    readonly changed: readonly { readonly host: AgentHost; readonly path: string }[];
    readonly skipped: readonly {
      readonly host: AgentHost;
      readonly path: string;
      readonly reason: string;
    }[];
  }
): void {
  if (provider === undefined) {
    output.success(`${hosts.join(", ")}: the agents run on the IDE's model again.`);
    for (const { host, path } of main.changed)
      output.info(`  ${host} main session: restored in ${path}`);
  } else {
    output.success(`Models on ${provider}, for every project on this machine:`);
    for (const host of hosts) {
      const skipped = main.skipped.some((entry) => entry.host === host);
      const written = main.changed.findLast((entry) => entry.host === host);
      const { model, effort } = tierModel(host, provider, AGENT_MODELS.main);
      const effortShown =
        AGENT_MODELS.hosts[host].main?.effortKey === undefined ? "" : ` (${effort})`;
      if (!skipped) {
        output.info(
          written === undefined
            ? `  ${host} main session: not managed by aidd, still the IDE's choice`
            : `  ${host} main session: ${model}${effortShown}, written in ${written.path}`
        );
      }
      for (const group of roleModels(host, provider)) {
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
): MarketplaceSourceMode | undefined {
  if (!cmdOptions.source) return undefined;
  if (cmdOptions.source === "local") {
    if (!cmdOptions.path) {
      output.error("--source local requires --path <dir>");
      process.exit(1);
    }
    return MarketplaceSourceMode.local(resolve(cmdOptions.path));
  }
  return MarketplaceSourceMode.remote(undefined, cmdOptions.release);
}

export function expandAllKeyword(raw: string | undefined, all: readonly ToolId[]): ToolId[] {
  if (raw === undefined) return [];
  if (raw.trim() === "all") return [...all];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as ToolId[];
}

/** `--ide` takes every tool, AI assistants and editors alike; `--ai`, its former spelling,
 * still takes AI tools alone. Each id lands in the list its category decides. */
export function parseToolIds(
  cmdOptions: SetupCmdOptions,
  errorHandler: ErrorHandler
): { aiTools: ToolId[]; ideTools: ToolId[] } | null {
  const aiIds = expandAllKeyword(cmdOptions.ai, AI_TOOL_IDS);
  const ids = expandAllKeyword(cmdOptions.ide, [...AI_TOOL_IDS, ...IDE_TOOL_IDS]);
  try {
    if (aiIds.length > 0 && cmdOptions.ai?.trim() !== "all")
      assertToolIdsMatchCategory(aiIds, "ai");
  } catch (e) {
    errorHandler.handle(e);
    return null;
  }
  const isIde = (id: ToolId) => (IDE_TOOL_IDS as readonly string[]).includes(id);
  const unique = [...new Set([...aiIds, ...ids])];
  return { aiTools: unique.filter((id) => !isIde(id)), ideTools: unique.filter(isIde) };
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

/** What `--global` does for each registered tool, read from its profile. */
export function globalSetupHelp(): string {
  const tools = [...getAllRegisteredTools().keys()].filter(supportsUserScopeActivation).sort();
  const native = tools.filter((id) => nativeActivationOf(id) !== undefined);
  const copying = tools.filter(copiesPluginFilesGlobally);
  const where = (id: ToolId) =>
    resolvePluginsCapability(id)?.userPluginsBaseDir("~")?.replaceAll("\\", "/");
  return [
    "",
    "Global:",
    `  Pass --ide ${tools.join(",")} (one or more, no editor) and --plugins all, recommended, none or names.`,
    `  ${native.join(", ")} enable the plugins through their own CLI, which must be on PATH.`,
    `  ${copying.map((id) => `${id} gets their files in ${where(id)}`).join(", ")}.`,
    "  `aidd sync --global` refreshes them from the framework source.",
  ].join("\n");
}

export function registerSetupCommand(program: Command): void {
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
      `Run each tool's main session and agents on this provider's model for their role (${agentProviders().join(", ")}), or none for the IDE's model`
    )
    .addHelpText("after", globalSetupHelp)
    .action(async (cmdOptions: SetupCmdOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      const source = parseSourceFlag(cmdOptions, output);
      const scope = cmdOptions.global === true ? "user" : parseScopeFlag(cmdOptions.scope, output);
      const toolIds = parseToolIds(cmdOptions, errorHandler);
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

        // One provider per run: claude and codex each run one only, so pairing them is refused
        // here, naming the host, before anything is built or written.
        const agentHosts = toolIds.aiTools.filter(isAgentHost);
        const provider = cmdOptions.provider === "none" ? undefined : cmdOptions.provider;
        const chosen = agentProviders().find((known) => known === provider);
        if (provider !== undefined && chosen === undefined) {
          throw new Error(
            `Unknown provider "${provider}". Use: ${agentProviders().join(", ")}, or none.`
          );
        }
        if (cmdOptions.provider !== undefined && agentHosts.length === 0) {
          throw new Error(
            `--provider needs --ide with a tool that runs the framework's agents: ${agentHostIds().join(", ")}.`
          );
        }
        if (provider !== undefined) {
          for (const host of agentHosts) supportedProvider(host, provider);
        }

        if (interactive) printWelcomeBanner(output);

        const deps = await createDeps(projectRoot, { verbose }, output);

        const result = await new SetupUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.setupMarketplaceRegistration,
          deps.marketplaceSyncSettingsUseCase,
          deps.setupToolsUseCase,
          deps.setupPluginsPromptUseCase,
          deps.currentVersionProvider,
          deps.setupToolsPromptUseCase,
          deps.projectContextDetector,
          deps.setupMachineScopeUseCase
        ).execute(flow);

        if (interactive && result.context !== undefined) {
          printDetectedContext(output, result.context.describe());
        }
        printSetupOutcome(output, result, verbose);
        // Once the install has succeeded: the provider and the main session's model hold for
        // every project on the machine, so a failed install leaves both as they were.
        if (cmdOptions.provider !== undefined) {
          const models = await deps.setAgentModelUseCase.execute({
            projectRoot,
            hosts: agentHosts,
            provider,
            scope: scope ?? "project",
          });
          reportAgentModels(output, chosen, agentHosts, models);
        }
        if (interactive) printNextSteps(output, result.install.results.length > 0);
        reportSyncActivation(output, result.activation);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
