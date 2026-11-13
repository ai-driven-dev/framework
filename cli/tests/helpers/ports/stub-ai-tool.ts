import {
  defineAiTool,
  type ProfileBrand,
} from "../../../src/contexts/tools/domain/profile/define-tool.js";
import type { AiTool } from "../../../src/contexts/tools/domain/profile.js";
import {
  PROFILE_SECTION_KEYS,
  type ProfileSection,
  type ProfileSectionKey,
  type ProfileSections,
} from "../../../src/contexts/tools/domain/profile.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
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
  const { kind: _kind, section: _section, configWrites: _configWrites, toolId, ...fields } = base;
  const kept = Object.fromEntries(
    PROFILE_SECTION_KEYS.map((key) => [key, base.section(key)] as const).filter(
      ([, section]) => section !== null
    )
  );
  const merged = Object.fromEntries(
    Object.entries({ ...kept, ...replacing }).filter(([, section]) => section !== null)
  );
  return defineAiTool({
    ...fields,
    toolId,
    // The files an install writes; a settings section's own file goes with the sections replaced.
    configAssets: Object.keys(base.configFiles()).flatMap((name) => base.configAsset(name) ?? []),
    capabilities: () => merged,
  });
}
