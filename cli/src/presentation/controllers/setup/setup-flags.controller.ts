import { resolve } from "node:path";
import { type Command, Option } from "commander";
import {
  type FrameworkSource,
  localFrameworkSource,
  remoteFrameworkSource,
} from "../../../contexts/distribution/contract/framework-source.js";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
// biome-ignore lint/plugin: filters the catalog's whole profiles to the AI tools active at user scope with a type guard, then reads five members; presentation has no ports/ to name a section in
import type {
  AiToolProfile,
  IdeToolProfile,
} from "../../../contexts/tools/contract/tool-profile.js";
import { selectTools } from "../../../contexts/tools/contract/tool-selection.model.js";
import type { PluginInstallMode } from "../../../orchestration/setup/setup-flow.model.js";
import type { Output } from "../../terminal/output.model.js";

export interface SetupCmdOptions {
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
  output: Output
): FrameworkSource | undefined {
  if (!cmdOptions.source) return undefined;
  if (cmdOptions.source === "local") {
    if (!cmdOptions.path) {
      output.error("--source local requires --path <dir>");
      output.exit(1);
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

export function parsePluginsFlag(
  raw: string | undefined,
  interactive: boolean
): { mode: PluginInstallMode; names: string[] } {
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

/** `--provider` names a tool that runs the agents, through `--ide`. */
export function requireAgentHosts(
  provider: string | undefined,
  request: { hosts: readonly string[]; runnable: readonly string[] }
): void {
  if (provider !== undefined && request.hosts.length === 0) {
    throw new Error(
      `--provider needs --ide with a tool that runs the framework's agents: ${request.runnable.join(", ")}.`
    );
  }
}

/** `--ide` takes every tool, AI assistants and editors alike; `--ai`, its former spelling,
 * still takes AI tools alone. Each id lands in the list its category decides. */
export function parseToolIds(
  cmdOptions: SetupCmdOptions,
  tools: ToolCatalog
): { aiTools: string[]; ideTools: string[] } {
  const aiIds = expandAllKeyword(cmdOptions.ai, tools.idsInCanonicalOrder("ai"));
  const ids = expandAllKeyword(cmdOptions.ide, tools.idsInCanonicalOrder());
  return selectTools(aiIds, ids, tools);
}

/** A catalog whose AI profiles say whether their own CLI activates plugins. */
export type SetupCatalog = ToolCatalog<AiToolProfile & { nativeActivation(): object | undefined }>;

export function activatesAtUserScope<A extends AiToolProfile>(
  profile: A | IdeToolProfile
): profile is A {
  return profile.kind === "ai" && profile.supportsUserScopeActivation();
}

/** What `--global` does for each registered tool, read from its profile. */
export function globalSetupHelp(catalog: SetupCatalog): string {
  const global = catalog
    .sortedIds()
    .map((id) => catalog.profile(id))
    .filter(activatesAtUserScope);
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

/** The options `setup` takes, with the help each one carries. */
export function declareSetupOptions(command: Command, catalog: ToolCatalog): Command {
  return command
    .option("--source <mode>", "Framework source: remote or local")
    .option("--path <dir>", "Absolute path to local framework (required with --source local)")
    .option("--release <tag>", "Marketplace release tag to fetch (e.g., v1.2.3)")
    .option(
      "--ide <ids>",
      `Comma-separated tool IDs, or 'all' (e.g., ${[catalog.inHelpOrder("ai")[0], catalog.inHelpOrder("ide")[0]].join(",")} or all)`
    )
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
    );
}
