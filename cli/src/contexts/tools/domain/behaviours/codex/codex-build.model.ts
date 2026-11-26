/** Codex's marketplace build contract: a native plugin tree. */

import { rulesArtifact } from "../../../../../shared/domain/materialization/artifact-path.js";
import type { ToolBuildContract } from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatArtifactLayout } from "../../../../../shared/domain/materialization/flat-paths.js";
import { tomlAgentMarkdownToToml } from "../../formats/agents/toml-agent.js";
import type { HooksRouting } from "../../formats/hooks/descriptor.js";
import { pluginTreeHooksArtifact } from "../../formats/hooks/routes.js";
import type { TomlCodec } from "../../formats/toml.js";
import {
  buildCodexManifest,
  buildCodexMarketplace,
  buildCodexMarketplaceEntry,
} from "./codex-marketplace.model.js";
import {
  OUTPUT_CODEX_AGENTS_DIR,
  OUTPUT_CODEX_MANIFEST_RELATIVE,
  OUTPUT_CODEX_MARKETPLACE_RELATIVE,
} from "./codex-paths.model.js";
import { stripCodexSkillFrontmatter } from "./codex-skill.model.js";

function codexPluginArtifacts(
  toml: TomlCodec,
  hooks: HooksRouting,
  rulesLayout: FlatArtifactLayout
): ToolBuildContract["artifacts"] {
  return {
    skills: {
      supported: true,
      source: { kind: "fullTree", srcDir: "skills" },
      placement: { kind: "relative" },
      skillFrontmatter: stripCodexSkillFrontmatter,
    },
    agents: {
      supported: true,
      source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
      placement: { kind: "agentFiles", dir: OUTPUT_CODEX_AGENTS_DIR, ext: ".toml", staged: true },
      transform: tomlAgentMarkdownToToml(toml),
    },
    rules: rulesArtifact(rulesLayout),
    mcp: {
      supported: true,
      source: { kind: "configFile", srcPath: ".mcp.json" },
      placement: { kind: "file", at: ".mcp.json" },
    },
    hooks: pluginTreeHooksArtifact(hooks),
  };
}

/** `rulesLayout` is where the flat build places a plugin's rules: a plugin's output carries them
 * there, for the installs that copy them out. */
export function buildCodexContract(
  toml: TomlCodec,
  hooks: HooksRouting,
  rulesLayout: FlatArtifactLayout
): ToolBuildContract {
  const manifestRelative = OUTPUT_CODEX_MANIFEST_RELATIVE;
  const marketplaceRelative = OUTPUT_CODEX_MARKETPLACE_RELATIVE;
  return {
    pluginRootToken: hooks.rootToken,
    manifestFileRelative: manifestRelative,
    synthesizeManifest: buildCodexManifest,
    manifestSchemaName: "codex-plugin-manifest",
    artifacts: codexPluginArtifacts(toml, hooks, rulesLayout),
    buildMarketplaceCatalog: async (source, entries, _fs) => ({
      catalog: buildCodexMarketplace(
        source as Parameters<typeof buildCodexMarketplace>[0],
        entries
      ),
      schemaName: "codex-marketplace",
      destRelPath: marketplaceRelative,
    }),
    buildMarketplaceEntry: async ({ name, srcEntry }) =>
      buildCodexMarketplaceEntry(name, srcEntry as Record<string, unknown> | undefined),
  };
}
