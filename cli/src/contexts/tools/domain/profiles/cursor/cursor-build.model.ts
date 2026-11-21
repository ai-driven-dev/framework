/**
 * Cursor's build contracts: marketplace (a native plugin tree) and flat (direct workspace
 * materialization). The transforms, path computations and merges are pure functions reused from
 * `domain/formats/`; the contracts themselves are thin wiring.
 */

import { parseFrontmatter, serializeFrontmatter } from "../../../../../shared/domain/markdown.js";
import {
  genericFlatAgentPath,
  genericFlatSkillPath,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import { rewriteRelativeLinks } from "../../../../../shared/domain/materialization/relative-link-rewrite.js";
import type { ToolBuildContract } from "../../../contract/build-contract.js";
import { mergeAdditiveMcp } from "../../formats/additive-mcp-merge.js";
import { flatTargetsOf } from "../../formats/flat-targets.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { pluginTreeHooksArtifact } from "../../formats/hooks/routes.js";
import {
  buildSharedEntry,
  buildSharedMarketplace,
  synthesizeSharedManifest,
} from "../../marketplace-catalog.js";
import { cursorAgentFrontmatter } from "./cursor-agent.model.js";

// Distinct from their source-side equivalents even where the literals coincide: a change to
// either side must not collapse them.
const OUTPUT_CURSOR_MANIFEST_RELATIVE = ".cursor-plugin/plugin.json";
const OUTPUT_CURSOR_MARKETPLACE_RELATIVE = ".cursor-plugin/marketplace.json";

function transformCursorAgent(content: string, plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const rewrittenBody = rewriteRelativeLinks(body, {
    currentFilePluginRelative: `agents/${outName}`,
  });
  const name = `${plugin}-${outName.replace(/\.md$/, "")}`;
  return serializeFrontmatter(
    cursorAgentFrontmatter({ ...frontmatter, name }),
    rewrittenBody,
    "double"
  );
}

type FlatHooks = HooksRouting & { readonly flat: FlatHooksRoute };

export function buildCursorContract(hooks: HooksRouting): ToolBuildContract {
  const manifestRelative = OUTPUT_CURSOR_MANIFEST_RELATIVE;
  const marketplaceRelative = OUTPUT_CURSOR_MARKETPLACE_RELATIVE;
  const namesHooks = hooks.manifestNamesHooks === true;
  return {
    pluginRootToken: hooks.rootToken,
    manifestFileRelative: manifestRelative,
    synthesizeManifest: (source, presence) =>
      synthesizeSharedManifest(source, presence, {
        agentsField: true,
        hooksField: namesHooks,
      }),
    manifestSchemaName: "plugin-manifest",
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: (_p, rel) => rel,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: (_p, rel) => rel,
        transform: transformCursorAgent,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        path: () => ".mcp.json",
      },
      hooks: pluginTreeHooksArtifact(hooks),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: async (source, entries, _fs) => ({
      catalog: buildSharedMarketplace(
        source as Parameters<typeof buildSharedMarketplace>[0],
        entries
      ),
      schemaName: "claude-marketplace",
      destRelPath: marketplaceRelative,
    }),
    buildMarketplaceEntry: async ({ name, outDir, srcEntry, fs }) =>
      buildSharedEntry({ fs, name, srcEntry, outDir, outputManifestRelative: manifestRelative }),
  };
}

function cursorFlatAgentPath(plugin: string, rel: string): string {
  return genericFlatAgentPath({
    agentsPrefix: ".cursor/agents/",
    plugin,
    agentBaseName: rel.replace(/^agents\//, ""),
    outputExt: ".md",
  });
}

function cursorFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(".cursor/skills/", plugin, rel.replace(/^skills\//, ""));
}

const cursorFlatResolveTarget = flatTargetsOf(cursorFlatAgentPath, cursorFlatSkillPath);

function transformCursorFlatAgent(content: string, plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const flatRelPath = cursorFlatAgentPath(plugin, `agents/${outName}`);
  const rewrittenBody = rewriteRelativeLinks(body, {
    currentFilePluginRelative: flatRelPath,
    resolveTargetPath: (rel) => cursorFlatResolveTarget(plugin, rel),
  });
  const name = `${plugin}-${outName.replace(/\.md$/, "")}`;
  return serializeFrontmatter(
    cursorAgentFrontmatter({ ...frontmatter, name }),
    rewrittenBody,
    "double"
  );
}

export function buildCursorFlatContract(hooks: FlatHooks): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: cursorFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: cursorFlatAgentPath,
        transform: transformCursorFlatAgent,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        path: () => ".cursor/mcp.json",
        merge: (existing, incoming, force) =>
          mergeAdditiveMcp(existing, incoming, { force, serversKey: "mcpServers" }),
        mcpServersKey: "mcpServers",
        mergeDest: (outDir) => `${outDir}/.cursor/mcp.json`,
      },
      hooks: flatHooksArtifact(hooks, { tool: "cursor" }),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
