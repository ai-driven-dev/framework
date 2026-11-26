/** Kilo's project distribution is flat. Its config and MCP format follow the OpenCode runtime,
 * but Kilo has its own .kilo/ discovery paths and bundled base configuration. */

import {
  agentsIn,
  rulesArtifact,
  skillsIn,
} from "../../../../../shared/domain/materialization/artifact-path.js";
import type {
  AgentMarkdown,
  ConfigArtifactFile,
  ConfigArtifactInput,
  ToolBuildContract,
} from "../../../../../shared/domain/materialization/build-contract.js";
import type {
  FlatArtifactLayout,
  FlatHooksLoaderEntry,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { addTypedInstruction } from "../../formats/mcp/typed-instructions.js";
import { buildTypedMcpFlatConfig } from "../../formats/mcp/typed-mcp-merge.js";
import { collectTypedMcp } from "../../formats/mcp/typed-mcp-section.js";
import { chooseOutputPath, type McpOutputPathCandidates } from "../../sections/mcp-section.js";
import { generateKiloHooksBridge } from "./kilo-hooks-bridge.model.js";

/** Kilo's hooks as the profile declares them: a loader with no hooks file. */
type KiloHooks = HooksRouting & {
  readonly file?: never;
  readonly flat: FlatHooksRoute & { readonly loaderEntry: FlatHooksLoaderEntry };
};

/** What the profile declares for a flat build: its agent markdown and its config candidates. */
interface KiloFlatData {
  readonly agentMarkdown: AgentMarkdown;
  readonly config: McpOutputPathCandidates;
}

function emitKiloConfig(
  candidates: McpOutputPathCandidates,
  { builtPlugins, pluginMcp, rulesGlobs, existing, assets }: ConfigArtifactInput
): readonly ConfigArtifactFile[] {
  const configPath = chooseOutputPath(candidates, (relPath) => existing.has(relPath));
  const incoming = collectTypedMcp(builtPlugins, pluginMcp);
  const asset = assets.get("kilo.json");
  const base = typeof asset === "string" ? asset : JSON.stringify(asset);
  const config = buildTypedMcpFlatConfig({
    baseConfig: base,
    existing: existing.get(configPath) ?? null,
    incoming,
  });
  const listed = rulesGlobs.reduce(addTypedInstruction, config);
  return [{ path: configPath, content: listed }];
}

export function buildKiloFlatContract(
  hooks: KiloHooks,
  layout: FlatArtifactLayout,
  { agentMarkdown, config }: KiloFlatData
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
      rules: rulesArtifact(layout),
      mcp: { supported: false, reason: "carried by the config artifact, not a file of its own" },
      hooks: flatHooksArtifact(hooks, { tool: "kilo", bridge: generateKiloHooksBridge }),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    configArtifact: {
      reads: () => config.tiers.flat(),
      probes: () => [],
      assets: { tool: "kilo", names: ["kilo.json"] },
      emit: (input) => emitKiloConfig(config, input),
    },
  };
}
