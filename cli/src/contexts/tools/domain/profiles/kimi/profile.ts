import { PluginsCapability } from "../../capabilities/plugins-capability.js";
import { SkillsCapability } from "../../capabilities/skills-capability.js";
import type { AiTool, HasPlugins, HasSkills } from "../../contracts.js";
import { stripToolSuffix } from "../../formats/command.js";
import { noFlatHooks } from "../../formats/hooks-descriptor.js";
import { registerTool } from "../../registry.js";
import { buildKimiFlatContract } from "./build.js";
import { KIMI_DIRECTORY, KIMI_SKILLS_DIR } from "./kimi-paths.js";

const TOOL_SUFFIX = ".kimi.md";

/** Agents come from the flat build contract alone: an AgentsCapability would also enable the
 * raw fallback route, which copies Claude frontmatter verbatim. */
export const kimi: AiTool<HasSkills & HasPlugins> = {
  kind: "ai",
  toolId: "kimi",
  directory: KIMI_DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Kimi Code CLI",
  signalDir: null,
  buildContracts: { flat: buildKimiFlatContract },

  capabilities: {
    skills: new SkillsCapability({
      directory: KIMI_DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      buildInstallPath: (fileName) => `${KIMI_SKILLS_DIR}${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
      convertFrontmatter: (fm) => fm,
    }),
    plugins: new PluginsCapability({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      flatSkillLayout: "single-level",
      // Plugin hooks arrive with the native `kimi.plugin.json` build.
      ...noFlatHooks("Kimi Code CLI hooks are not wired yet."),
    }),
  },

  rewriteContent(content: string): string {
    return content;
  },
};

registerTool(kimi);
