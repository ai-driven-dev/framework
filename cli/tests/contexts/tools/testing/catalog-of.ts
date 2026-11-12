import { RegisteredToolCatalog } from "../../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { ToolCatalog } from "../../../../src/contexts/tools/contract/tool-catalog.js";
import type {
  AiToolProfile,
  ToolProfile,
} from "../../../../src/contexts/tools/contract/tool-profile.js";
import {
  aiProfileOf,
  profileOf,
} from "../../../../src/contexts/tools/contract/tool-profile-lookup.js";
import { REGISTERED_PROFILES } from "../../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import type { BuiltToolConfig } from "../../../../src/contexts/tools/domain/registry.js";
import type { AiToolId, ToolId } from "../../../../src/kernel/tool.js";

/** A catalog over the given profiles, the registered ones when none is given. Built inside the
 * `it` that reads it: a catalog is a value, never shared state. */
export function catalogOf(profiles: readonly BuiltToolConfig[] = REGISTERED_PROFILES): ToolCatalog {
  return new RegisteredToolCatalog(profiles);
}

/** The registered profile of one AI tool, for a test that hands a profile to code that asks one. */
export function registeredAiProfile(id: AiToolId): AiToolProfile {
  return aiProfileOf(catalogOf().sortedById(), id);
}

/** The registered profile of one tool of either kind. */
export function registeredProfile(id: ToolId): ToolProfile {
  return profileOf(catalogOf().sortedById(), id);
}
