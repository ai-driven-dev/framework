// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../assets/hooks-runtime/host-kiro.cjs";
import { buildKiroFlatContract } from "../../contexts/tools/domain/behaviours/kiro/kiro-build.model.js";
import { kiroHooksFormat } from "../../contexts/tools/domain/behaviours/kiro/kiro-hooks.model.js";
import { agentFrontmatterOf } from "../../contexts/tools/domain/formats/agents/agent-format.js";
import { declareHooks } from "../../contexts/tools/domain/formats/hooks/declaration.js";
import {
  flatHooksSupport,
  flatProjectHooksDelivery,
} from "../../contexts/tools/domain/formats/hooks/flat-routes.js";
import { inclusionModesRule } from "../../contexts/tools/domain/formats/rule-frontmatter.js";
import { contract } from "../../contexts/tools/domain/profile/contract-builders.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { installUnder } from "../../contexts/tools/domain/profile/tool-suffix.js";
import { flatPlacement } from "../../contexts/tools/domain/sections/layout-section.js";
import type { AgentMarkdown } from "../../shared/domain/materialization/build-contract.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";

const DIRECTORY = ".kiro/";
const TOOL_SUFFIX = ".kiro.md";
const STEERING = "steering/";
/** Kiro's project MCP servers file, an `mcpServers` object (https://kiro.dev/docs/mcp/configuration/). */
const MCP_PATH = `${DIRECTORY}settings/mcp.json`;

/** An agent file may be Markdown with YAML front matter, its name derived from the filename when
 * absent and `*` meaning every tool (https://kiro.dev/docs/custom-agents/configuration-reference/).
 * `set: { tools: ["*"] }` also replaces a list a plugin agent declares, which widens it; no plugin
 * agent declares tools today. Its `model` is left out: Kiro's ids are not Claude's. */
const AGENT_FRONTMATTER = agentFrontmatterOf({
  keep: ["name", "description"],
  set: { tools: ["*"] },
});

const AGENT_MARKDOWN: AgentMarkdown = {
  frontmatter: AGENT_FRONTMATTER,
  pluginPrefixedName: true,
};

/** Skills, agents and rules live under `.kiro/skills/`, `.kiro/agents/` and `.kiro/steering/`
 * (https://kiro.dev/docs/configuration/); a skill's `name` must equal its folder
 * (https://kiro.dev/docs/skills/), so the folder carries the plugin. A rule is a steering file
 * scoped by its `inclusion` front matter (https://kiro.dev/docs/steering/). */
const KIRO_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(DIRECTORY, {
  skills: "single-level",
  rules: "top-level",
  rulesDir: `${DIRECTORY}${STEERING}`,
  agent: { ext: ".md" },
});

/** The tag Kiro selects a tool by, for each Claude tool a plugin's hook matcher names: the `write`
 * tag was seen matching `fs_write` and `str_replace`, the `shell` tag `execute_bash`. `Delete` and
 * `PowerShell` rest on the vendor docs' tool families alone (https://kiro.dev/docs/hooks/types/),
 * no capture. A name with no entry, such as `apply_patch`, selects nothing. A hook is never given
 * a regular expression to select by: each tag gets its own hook. */
const MATCHER_TOOLS: ReadonlyMap<string, string> = new Map([
  ["Write", "write"],
  ["Edit", "write"],
  ["Delete", "write"],
  ["Bash", "shell"],
  ["Shell", "shell"],
  ["PowerShell", "shell"],
]);

const hooks = declareHooks(
  { toolId: "kiro", directory: DIRECTORY, adapter },
  {
    // Only the events with a payload captured from kiro-cli V3 (the kiro-* hook-payload fixtures)
    // are delivered; https://kiro.dev/docs/hooks/types/ names the triggers. SessionEnd is
    // documented but seen firing in one of six headless runs, so it is dropped from the merge with a
    // warning, like every other event.
    undeclaredEvents: "skipped",
    events: {
      SessionStart: "SessionStart",
      UserPromptSubmit: "UserPromptSubmit",
      PreToolUse: "PreToolUse",
      PostToolUse: "PostToolUse",
      Stop: "Stop",
      SubagentStop: "SubagentStop",
    },
    toolNames: MATCHER_TOOLS,
    // Kiro loads every `.kiro/hooks/*.json` of a project, and CLI V3 those of `~/.kiro/hooks/`
    // too (https://kiro.dev/docs/hooks/): every plugin's entries share one file of AIDD's own.
    flat: { scriptsDir: `${DIRECTORY}hooks/`, sharedFile: `${DIRECTORY}hooks/aidd.json` },
  }
);

const hooksDelivery = flatProjectHooksDelivery(
  flatHooksSupport(hooks),
  hooks.flat,
  kiroHooksFormat(hooks)
);

export const kiro = defineAiTool({
  toolId: "kiro",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Kiro",
  signalDir: null,
  hooks,
  buildContracts: {
    flat: contract(
      buildKiroFlatContract,
      hooks,
      { layout: KIRO_FLAT_LAYOUT, mcpPath: MCP_PATH },
      AGENT_MARKDOWN
    ),
  },

  capabilities: {
    agents: { format: "markdown", frontmatter: AGENT_FRONTMATTER },
    skills: { directory: DIRECTORY },
    rules: {
      buildInstallPath: installUnder(DIRECTORY, TOOL_SUFFIX, STEERING),
      convertFrontmatter: inclusionModesRule,
    },
    hooks: { delivery: hooksDelivery },
    layout: flatPlacement({ namespacePrefix: "aidd-", artifacts: KIRO_FLAT_LAYOUT }),
  },

  linkSyntax: [],
});
