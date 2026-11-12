import { RegisteredToolCatalog } from "../../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { ToolBuildContract } from "../../../../src/contexts/tools/contract/build-contract.js";
import type { ToolCatalog } from "../../../../src/contexts/tools/contract/tool-catalog.js";
import type {
  AiToolProfile,
  ToolProfile,
} from "../../../../src/contexts/tools/contract/tool-profile.js";
import {
  aiProfileOf,
  profileOf,
} from "../../../../src/contexts/tools/contract/tool-profile-lookup.js";
import type { AiTool } from "../../../../src/contexts/tools/domain/contracts.js";
import type { BuiltToolConfig } from "../../../../src/contexts/tools/domain/profile/define-tool.js";
import { REGISTERED_PROFILES } from "../../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import { UnregisteredToolError } from "../../../../src/kernel/errors.js";
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

/** Every registered profile in id order: what an edge hands a use case that asks its tools per call. */
export function registeredProfiles(): readonly ToolProfile[] {
  return catalogOf().sortedById();
}

/** The registered profile as the tools context holds it, for a test of what a profile declares
 * beyond what the contract answers. */
export function registeredConfig(id: ToolId): BuiltToolConfig {
  const found = REGISTERED_PROFILES.find((profile) => profile.toolId === id);
  if (found === undefined) throw new UnregisteredToolError(id);
  return found;
}

export function registeredAiConfig(id: AiToolId): AiTool {
  const config = registeredConfig(id);
  if (config.kind !== "ai") throw new UnregisteredToolError(id);
  return config;
}

/** The flat build contract a registered tool declares, or null when it declares none. */
export function registeredFlatContract(id: ToolId): ToolBuildContract | null {
  const config = registeredConfig(id);
  return config.kind === "ai" ? config.buildContract("flat") : null;
}
