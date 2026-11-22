import { REGISTERED_PROFILES } from "../../../src/composition/tool-profiles.js";
import { RegisteredToolCatalog } from "../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import type {
  AiToolProfile,
  ToolProfile,
} from "../../../src/contexts/tools/contract/tool-profile.js";
import type { BuiltToolConfig } from "../../../src/contexts/tools/domain/profile/define-tool.js";
import type { AiTool } from "../../../src/contexts/tools/domain/profile.js";
import { UnregisteredToolError } from "../../../src/shared/domain/shared.error.js";
import type { AiToolId, ToolId } from "../../../src/shared/domain/tool.js";

/** A catalog over the given profiles, in the given order, the registered ones when none is given.
 * Built inside the `it` that reads it: a catalog is a value, never shared state. */
export function catalogOf(profiles: readonly BuiltToolConfig[] = REGISTERED_PROFILES): ToolCatalog {
  return new RegisteredToolCatalog(profiles);
}

/** The registered profile of one AI tool, for a test that hands a profile to code that asks one. */
export function registeredAiProfile(id: AiToolId): AiToolProfile {
  return catalogOf().aiProfile(id);
}

/** The registered profile of one tool of either kind. */
export function registeredProfile(id: ToolId): ToolProfile {
  return catalogOf().profile(id);
}

/** The registered catalog: what an edge hands a use case that still takes its tools per call. */
export function registeredCatalog(): ToolCatalog {
  return catalogOf();
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

/** The registered AI id a name answers to, for a generic test that needs a real host profile's id. */
export function registeredAiId(name: string): AiToolId {
  const id = catalogOf().aiToolId(name);
  if (id === null) throw new UnregisteredToolError(name);
  return id;
}
