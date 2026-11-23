/** Codex's marketplace build contract: a native plugin tree. */

import type { ToolBuildContract } from "../../../contract/build-contract.js";
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
  hooks: HooksRouting
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
      placement: { kind: "agentFiles", dir: OUTPUT_CODEX_AGENTS_DIR, ext: ".toml" },
      transform: tomlAgentMarkdownToToml(toml),
    },
    mcp: {
      supported: true,
      source: { kind: "configFile", srcPath: ".mcp.json" },
      placement: { kind: "file", at: ".mcp.json" },
    },
    hooks: pluginTreeHooksArtifact(hooks),
  };
}

export function buildCodexContract(toml: TomlCodec, hooks: HooksRouting): ToolBuildContract {
  const manifestRelative = OUTPUT_CODEX_MANIFEST_RELATIVE;
  const marketplaceRelative = OUTPUT_CODEX_MARKETPLACE_RELATIVE;
  return {
    pluginRootToken: hooks.rootToken,
    manifestFileRelative: manifestRelative,
    synthesizeManifest: buildCodexManifest,
    manifestSchemaName: "codex-plugin-manifest",
    artifacts: codexPluginArtifacts(toml, hooks),
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
