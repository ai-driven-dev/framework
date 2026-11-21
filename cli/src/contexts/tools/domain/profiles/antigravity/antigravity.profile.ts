// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../../../../assets/hooks-runtime/host-antigravity.cjs";
import { declareHooks } from "../../formats/hooks/declaration.js";
import { flatHooksSupport, flatProjectHooksDelivery } from "../../formats/hooks/flat-routes.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { flatPlacement } from "../../sections/layout-section.js";
import { buildAntigravityFlatContract } from "./antigravity-build.model.js";
import { antigravityHooksFormat } from "./antigravity-hooks.model.js";

const DIRECTORY = ".agents/";
const TOOL_SUFFIX = ".antigravity.md";
const SKILLS_PREFIX = "aidd-";

function skillName(fileName: string): string {
  const base = fileName.split("/")[0] as string;
  return base.endsWith(TOOL_SUFFIX)
    ? base.slice(0, -TOOL_SUFFIX.length)
    : base.replace(/\.md$/, "");
}

const hooks = declareHooks(
  { toolId: "antigravity", directory: DIRECTORY, adapter },
  {
    events: { SessionStart: "SessionStart" },
    // Claude and `agy` name their tools differently, so only the tool-free event is carried over.
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
  buildContracts: { flat: () => buildAntigravityFlatContract(hooks) },

  capabilities: (bound) => ({
    skills: bound.skills({
      agentsSkillsDirectory: true,
      buildInstallPath: (fileName) =>
        `${bound.installUnder(`skills/${SKILLS_PREFIX}`)(skillName(fileName))}/SKILL.md`,
      convertFrontmatter: (fm) => fm,
    }),
    hooks: { delivery: hooksDelivery },
    layout: flatPlacement({
      namespacePrefix: "aidd-",
      skillLayout: "single-level",
    }),
  }),

  linkSyntax: [],
});
