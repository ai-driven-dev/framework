import {
  defineAiTool,
  type ProfileBrand,
} from "../../../../src/contexts/tools/domain/profile/define-tool.js";
import type { AiTool, ProfileSections } from "../../../../src/contexts/tools/domain/profile.js";
import type { AiToolId } from "../../../../src/shared/domain/tool.js";
import { anEmptyContract } from "../../../shared/testing/empty-build-contract.builder.js";

export function stubAiTool(toolId: AiToolId, capabilities: ProfileSections): AiTool & ProfileBrand {
  return defineAiTool({
    toolId,
    directory: `.${toolId}/`,
    toolSuffix: `.${toolId}.md`,
    signalDir: null,
    displayName: toolId,
    buildContracts: { flat: () => anEmptyContract() },
    capabilities: () => capabilities,
    linkSyntax: [],
  });
}
