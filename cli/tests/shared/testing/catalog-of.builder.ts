import type { RegisteredCatalog } from "../../../src/composition/contexts/tools.js";
import {
  REGISTERED_PROFILES,
  type RegisteredAiProfile,
  type RegisteredProfile,
} from "../../../src/composition/tool-profiles/index.js";
import { withNativeRegistration } from "../../../src/contexts/host-registration/domain/native-registration/native-host-profile.js";
import { RegisteredToolCatalog } from "../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { ToolProfile } from "../../../src/contexts/tools/contract/tool-profile.js";
import type { ProfileBrand } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import type { AiTool, IdeToolConfig } from "../../../src/contexts/tools/domain/profile.js";
import { UnregisteredToolError } from "../../../src/shared/domain/shared.error.js";
import type { AiToolId, ToolId } from "../../../src/shared/domain/tool.js";

/** A profile only the factory could have produced, before the composition registers it. */
export type BuiltToolConfig = (AiTool | IdeToolConfig) & ProfileBrand;

/** A profile as the composition registers it: an AI content profile built by a test carries no
 * native section, so it is assembled with an empty one. */
export function registeredFrom(profile: BuiltToolConfig | RegisteredProfile): RegisteredProfile {
  return isRegistered(profile) ? profile : withNativeRegistration(profile, {});
}

/** An editor needs no native section; an AI profile is registered once it answers one. */
function isRegistered(profile: BuiltToolConfig | RegisteredProfile): profile is RegisteredProfile {
  return profile.kind !== "ai" || "nativeActivation" in profile;
}

/** A catalog over the given profiles, in the given order, the registered ones when none is given.
 * Built inside the `it` that reads it: a catalog is a value, never shared state. */
export function catalogOf(
  profiles: readonly (BuiltToolConfig | RegisteredProfile)[] = REGISTERED_PROFILES
): RegisteredCatalog {
  return new RegisteredToolCatalog<RegisteredAiProfile>(profiles.map(registeredFrom));
}

/** The registered profile of one AI tool, for a test that hands a profile to code that asks one. */
export function registeredAiProfile(id: AiToolId): RegisteredAiProfile {
  return catalogOf().aiProfile(id);
}

/** The registered profile of one tool of either kind. */
export function registeredProfile(id: ToolId): ToolProfile {
  return catalogOf().profile(id);
}

/** The registered catalog: what an edge hands a use case that still takes its tools per call. */
export function registeredCatalog(): RegisteredCatalog {
  return catalogOf();
}

/** The registered profile as the composition holds it, for a test of what a profile declares
 * beyond what the contract answers. */
export function registeredConfig(id: ToolId): RegisteredProfile {
  const found = REGISTERED_PROFILES.find((profile) => profile.toolId === id);
  if (found === undefined) throw new UnregisteredToolError(id);
  return found;
}

export function registeredAiConfig(id: AiToolId): RegisteredAiProfile {
  const config = registeredConfig(id);
  if (config.kind !== "ai") throw new UnregisteredToolError(id);
  return config;
}
