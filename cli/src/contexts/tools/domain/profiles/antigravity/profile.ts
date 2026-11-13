import { flatHooksSupport, flatProjectHooksDelivery } from "../../formats/hooks-descriptor.js";
import { pluginsCapability } from "../../plugins/plugins-capability.js";
import { defineAiTool } from "../../profile/define-tool.js";
import {
  antigravityHookEntries,
  antigravityHooksScriptDir,
  antigravityHooksScriptPath,
  isAntigravityHooksFileEmpty,
  mergeAntigravityHooks,
  unmergeAntigravityHooks,
} from "./antigravity-hooks.js";
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
    plugins: pluginsCapability({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      flatSkillLayout: "single-level",
      ...flatHooksSupport(ANTIGRAVITY_HOOKS),
      ...flatProjectHooksDelivery(ANTIGRAVITY_HOOKS.flat, {
        merge: mergeAntigravityHooks,
        unmerge: unmergeAntigravityHooks,
        contributedEntries: antigravityHookEntries,
        isEmpty: isAntigravityHooksFileEmpty,
        scriptPath: antigravityHooksScriptPath,
        scriptDir: antigravityHooksScriptDir,
      }),
    }),
  }),

  rewriteContent(content: string): string {
    return content;
  },
});
