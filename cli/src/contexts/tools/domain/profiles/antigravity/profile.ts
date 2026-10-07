import { PluginsCapability } from "../../capabilities/plugins-capability.js";
import { SkillsCapability } from "../../capabilities/skills-capability.js";
import type { AiTool, HasPlugins, HasSkills } from "../../contracts.js";
import { registerTool } from "../../registry.js";
import { ANTIGRAVITY_DIRECTORY } from "./antigravity-paths.js";
import { buildAntigravityFlatContract } from "./build.js";

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

export const antigravity: AiTool<HasSkills & HasPlugins> = {
  kind: "ai",
  toolId: "antigravity",
  directory: ANTIGRAVITY_DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Antigravity CLI",
  telemetryLocalRead: {
    kind: "unsupported",
    reason: "Antigravity CLI telemetry is not yet supported by AIDD.",
  },
  telemetryTaskAttributable: false,
  signalDir: null,
  buildContracts: { flat: buildAntigravityFlatContract },

  capabilities: {
    skills: new SkillsCapability({
      toolSuffix: TOOL_SUFFIX,
      prefix: SKILLS_PREFIX,
      buildInstallPath: (fileName) =>
        `${ANTIGRAVITY_DIRECTORY}skills/${SKILLS_PREFIX}${skillName(fileName)}/SKILL.md`,
      convertFrontmatter: (fm) => fm,
    }),
    plugins: new PluginsCapability({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      flatSkillLayout: "single-level",
      acceptsHooks: false,
      hooksUnsupportedReason:
        "Antigravity CLI hooks are not wired yet (follow-up phase 3 of #511: .agents/hooks.json).",
    }),
  },

  rewriteContent(content: string): string {
    return content;
  },
};

registerTool(antigravity);
