import { flatHooksSupport, flatProjectHooksDelivery } from "../../formats/hooks-descriptor.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { flatPlacement } from "../../sections/layout-section.js";
import { antigravityHooksFormat } from "./antigravity-hooks.js";
import { ANTIGRAVITY_DIRECTORY } from "./antigravity-paths.js";
import { buildAntigravityFlatContract } from "./build.js";
import { ANTIGRAVITY_HOOKS } from "./hooks.js";

const TOOL_SUFFIX = ".antigravity.md";
const SKILLS_PREFIX = "aidd-";

function skillName(fileName: string): string {
  const parts = fileName.split("/");
  if (parts.length > 1) return parts[0] as string;
  const base = parts[0] as string;
  return base.endsWith(TOOL_SUFFIX)
    ? base.slice(0, -TOOL_SUFFIX.length)
    : base.replace(/\.md$/, "");
}

const hooksDelivery = flatProjectHooksDelivery(
  flatHooksSupport(ANTIGRAVITY_HOOKS),
  ANTIGRAVITY_HOOKS.flat,
  antigravityHooksFormat()
);

export const antigravity = defineAiTool({
  toolId: "antigravity",
  directory: ANTIGRAVITY_DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Antigravity CLI",
  signalDir: null,
  buildContracts: { flat: buildAntigravityFlatContract },

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

  rewriteContent(content: string): string {
    return content;
  },
});
