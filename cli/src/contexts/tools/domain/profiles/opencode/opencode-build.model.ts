/**
 * Opencode's build contract: flat only: opencode has no marketplace mode.
 */

import type { FlatHooksLoaderEntry } from "../../../../../shared/domain/materialization/flat-paths.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
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
import { buildTypedMcpFlatConfig } from "../../formats/typed-mcp-merge.js";
import { collectTypedMcp } from "../../formats/typed-mcp-section.js";
import { opencodeAgentFrontmatter } from "./opencode-agent.model.js";
import { generateOpencodeHooksBridge } from "./opencode-hooks-bridge.model.js";

/** OpenCode's hooks as the profile declares them: a loader with no hooks file, and the runtime
 * its bridges import. */
type OpencodeHooks = HooksRouting & {
  readonly file?: never;
  readonly flat: FlatHooksRoute & { readonly loaderEntry: FlatHooksLoaderEntry };
  readonly bridgeRuntime: NonNullable<HooksDescriptor["bridgeRuntime"]>;
};

/** Where a flat build, and a flat install, put opencode's skills and agents. */
export const OPENCODE_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(".opencode/", {
  skills: "nested",
  agent: { ext: ".md" },
});

const opencodeAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter) => opencodeAgentFrontmatter(frontmatter),
};

const OPENCODE_JSONC = "opencode.jsonc";
const OPENCODE_JSON = "opencode.json";

/** A built plugin's own loader or its generated bridge: either means OpenCode will run hooks. */
function pluginLoaders(hooks: OpencodeHooks, plugin: string): readonly string[] {
  const { loaderEntry } = hooks.flat;
  return [`${loaderEntry.dir}${plugin}.js`, hooksBridgePath(loaderEntry, plugin)];
}

function emitOpencodeConfig(
  hooks: OpencodeHooks,
  { builtPlugins, pluginMcp, existing, present, assets }: ConfigArtifactInput
): readonly ConfigArtifactFile[] {
  const configPath = existing.has(OPENCODE_JSONC) ? OPENCODE_JSONC : OPENCODE_JSON;
  const incoming = collectTypedMcp(builtPlugins, pluginMcp);
  const baseAsset = assets.get(OPENCODE_JSON);
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

export function buildOpencodeFlatContract(hooks: OpencodeHooks): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        placement: skillsIn(OPENCODE_FLAT_LAYOUT),
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        placement: agentsIn(OPENCODE_FLAT_LAYOUT),
        agentMarkdown: opencodeAgentMarkdown,
      },
      mcp: { supported: false }, // handled by configArtifact (opencode.json mcp)
      hooks: flatHooksArtifact(hooks, { bridge: generateOpencodeHooksBridge }),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    configArtifact: {
      reads: () => [OPENCODE_JSONC, OPENCODE_JSON],
      probes: (builtPlugins) => builtPlugins.flatMap((plugin) => pluginLoaders(hooks, plugin)),
      assets: { tool: "opencode", names: [OPENCODE_JSON, hooks.bridgeRuntime.asset] },
      emit: (input) => emitOpencodeConfig(hooks, input),
    },
  };
}
