import type { AiTool } from "../../../src/contexts/tools/domain/contracts.js";
import {
  defineAiTool,
  type ProfileBrand,
} from "../../../src/contexts/tools/domain/profile/define-tool.js";
import {
  PROFILE_SECTION_KEYS,
  type ProfileSection,
  type ProfileSectionKey,
  type ProfileSections,
} from "../../../src/contexts/tools/domain/profile/profile-sections.js";
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

/** A copy of a real profile whose sections are replaced (`null` drops one), rebuilt through the
 * factory so it is as refusable as the original. */
export function withSections(
  base: AiTool,
  replacing: { readonly [K in ProfileSectionKey]?: ProfileSection<K> | null }
): AiTool & ProfileBrand {
  const { kind: _kind, section: _section, toolId, ...fields } = base;
  const kept = Object.fromEntries(
    PROFILE_SECTION_KEYS.map((key) => [key, base.section(key)] as const).filter(
      ([, section]) => section !== null
    )
  );
  const merged = Object.fromEntries(
    Object.entries({ ...kept, ...replacing }).filter(([, section]) => section !== null)
  );
  return defineAiTool({ ...fields, toolId, capabilities: () => merged });
}
