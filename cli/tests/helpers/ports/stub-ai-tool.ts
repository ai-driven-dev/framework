import type { AiTool } from "../../../src/contexts/tools/domain/contracts.js";
import {
  defineAiTool,
  type ProfileBrand,
} from "../../../src/contexts/tools/domain/profile/define-tool.js";
import type { ProfileSections } from "../../../src/contexts/tools/domain/profile/profile-sections.js";
import type { AiToolId } from "../../../src/kernel/tool.js";
import { anEmptyContract } from "../../contexts/tools/testing/profiles.js";

export function stubAiTool(toolId: AiToolId, capabilities: ProfileSections): AiTool & ProfileBrand {
  return defineAiTool({
    toolId,
    directory: `.${toolId}/`,
    toolSuffix: `.${toolId}.md`,
    signalDir: null,
    displayName: toolId,
    buildContracts: { flat: () => anEmptyContract() },
    capabilities: () => capabilities,
    rewriteContent: (content: string) => content,
  });
}
