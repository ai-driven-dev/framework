// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../assets/hooks-runtime/host-antigravity.cjs";
import { buildAntigravityFlatContract } from "../../contexts/tools/domain/behaviours/antigravity/antigravity-build.model.js";
import { antigravityHooksFormat } from "../../contexts/tools/domain/behaviours/antigravity/antigravity-hooks.model.js";
import { declareHooks } from "../../contexts/tools/domain/formats/hooks/declaration.js";
import {
  flatHooksSupport,
  flatProjectHooksDelivery,
} from "../../contexts/tools/domain/formats/hooks/flat-routes.js";
import { contract } from "../../contexts/tools/domain/profile/contract-builders.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { flatPlacement } from "../../contexts/tools/domain/sections/layout-section.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";

const DIRECTORY = ".agents/";

/** Where a flat build, and a flat install, put antigravity's skills and agents. */
const ANTIGRAVITY_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(".agents/", {
  skills: "single-level",
  agent: { folderFile: "agent.md" },
});
const TOOL_SUFFIX = ".antigravity.md";

/** Each Claude tool an agent may declare, by the name `agy` gives it in a subagent's `tools`. The
 * names come from the `tools` field and its example on https://antigravity.google/docs/subagents
 * (view_file, grep_search, replace_file_content, run_command), and from a real `agy` run for
 * write_file: that page's hooks reference calls it write_to_file, which `agy` never called. A tool
 * with no name cited there, such as Glob, WebFetch or Task, is left out: an unknown name may hang
 * the subagent. */
const AGENT_TOOLS: ReadonlyMap<string, string> = new Map([
  ["Read", "view_file"],
  ["Grep", "grep_search"],
  ["Edit", "replace_file_content"],
  ["Write", "write_file"],
  ["Bash", "run_command"],
]);

const hooks = declareHooks(
  { toolId: "antigravity", directory: DIRECTORY, adapter },
  {
    // `agy` fires none of UserPromptSubmit, SubagentStop and SessionEnd, and no plugin declares
    // PreToolUse.
    events: {
      SessionStart: "SessionStart",
      PostToolUse: "PostToolUse",
      Stop: "Stop",
    },
    // Its tools are named `write_file` and `run_command`: the adapter reads those, and the handler
    // is grouped under the matcher `*`, so every tool call runs a PostToolUse script. The plugin's
    // matcher is not translated. A PostToolUse answer injects nothing: only PostInvocation can, and it is not relayed.
    // `agy` reads hooks only from the project's `.agents/hooks.json`, keyed by hook name, and runs
    // each handler from `<repo>/.agents`.
    flat: {
      scriptsDir: `${DIRECTORY}hooks/`,
      sharedFile: `${DIRECTORY}hooks.json`,
    },
  }
);

const hooksDelivery = flatProjectHooksDelivery(
  flatHooksSupport(hooks),
  hooks.flat,
  antigravityHooksFormat(hooks)
);

export const antigravity = defineAiTool({
  toolId: "antigravity",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Antigravity CLI",
  signalDir: null,
  hooks,
  buildContracts: {
    flat: contract(buildAntigravityFlatContract, hooks, ANTIGRAVITY_FLAT_LAYOUT, AGENT_TOOLS),
  },

  capabilities: {
    skills: {
      agentsSkillsDirectory: true,
    },
    hooks: { delivery: hooksDelivery },
    layout: flatPlacement({
      namespacePrefix: "aidd-",
      artifacts: ANTIGRAVITY_FLAT_LAYOUT,
    }),
  },

  linkSyntax: [],
});
