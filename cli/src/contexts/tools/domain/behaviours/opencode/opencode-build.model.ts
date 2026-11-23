/**
 * Opencode's build contract: flat only: opencode has no marketplace mode.
 */

import type {
  FlatArtifactLayout,
  FlatHooksLoaderEntry,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import { agentsIn, skillsIn } from "../../../contract/artifact-path.js";
import type {
  AgentMarkdown,
  ConfigArtifactFile,
  ConfigArtifactInput,
  ToolBuildContract,
} from "../../../contract/build-contract.js";
import type {
  FlatHooksRoute,
  HooksDescriptor,
  HooksRouting,
} from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact, hooksBridgePath } from "../../formats/hooks/flat-routes.js";
import { buildTypedMcpFlatConfig } from "../../formats/mcp/typed-mcp-merge.js";
import { collectTypedMcp } from "../../formats/mcp/typed-mcp-section.js";
import { chooseOutputPath, type McpOutputPathCandidates } from "../../sections/mcp-section.js";
import { generateOpencodeHooksBridge } from "./opencode-hooks-bridge.model.js";

/** OpenCode's hooks as the profile declares them: a loader with no hooks file, and the runtime
 * its bridges import. */
type OpencodeHooks = HooksRouting & {
  readonly file?: never;
  readonly flat: FlatHooksRoute & { readonly loaderEntry: FlatHooksLoaderEntry };
  readonly bridgeRuntime: NonNullable<HooksDescriptor["bridgeRuntime"]>;
};

/** The bundled base configuration, by its asset name. */
const CONFIG_ASSET = "opencode.json";

/** What the profile declares for a flat build: its agent markdown and its config candidates. */
interface OpencodeFlatData {
  readonly agentMarkdown: AgentMarkdown;
  readonly config: McpOutputPathCandidates;
}

/** A built plugin's own loader or its generated bridge: either means OpenCode will run hooks. */
function pluginLoaders(hooks: OpencodeHooks, plugin: string): readonly string[] {
  const { loaderEntry } = hooks.flat;
  return [`${loaderEntry.dir}${plugin}.js`, hooksBridgePath(loaderEntry, plugin)];
}

function emitOpencodeConfig(
  { hooks, candidates }: { hooks: OpencodeHooks; candidates: McpOutputPathCandidates },
  { builtPlugins, pluginMcp, existing, present, assets }: ConfigArtifactInput
): readonly ConfigArtifactFile[] {
  const configPath = chooseOutputPath(candidates, (relPath) => existing.has(relPath));
  const incoming = collectTypedMcp(builtPlugins, pluginMcp);
  const baseAsset = assets.get(CONFIG_ASSET);
  const base = typeof baseAsset === "string" ? baseAsset : JSON.stringify(baseAsset);
  const config = {
    path: configPath,
    content: buildTypedMcpFlatConfig({
      baseConfig: base,
      existing: existing.get(configPath) ?? null,
      incoming,
    }),
  };
  const runsHooks = builtPlugins.some((plugin) =>
    pluginLoaders(hooks, plugin).some((loader) => present.has(loader))
  );
  if (!runsHooks) return [config];
  const runtime = hooks.bridgeRuntime;
  const events = assets.get(runtime.asset);
  if (typeof events !== "string") throw new TypeError("OpenCode event adapter must be source text");
  return [config, { path: runtime.path, content: events }];
}

export function buildOpencodeFlatContract(
  hooks: OpencodeHooks,
  layout: FlatArtifactLayout,
  { agentMarkdown, config }: OpencodeFlatData
): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        placement: skillsIn(layout),
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        placement: agentsIn(layout),
        agentMarkdown,
      },
      mcp: { supported: false, reason: "carried by the config artifact (opencode.json mcp)" },
      hooks: flatHooksArtifact(hooks, { bridge: generateOpencodeHooksBridge }),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    configArtifact: {
      reads: () => config.tiers.flat(),
      probes: (builtPlugins) => builtPlugins.flatMap((plugin) => pluginLoaders(hooks, plugin)),
      assets: { tool: "opencode", names: [CONFIG_ASSET, hooks.bridgeRuntime.asset] },
      emit: (input) => emitOpencodeConfig({ hooks, candidates: config }, input),
    },
  };
}
