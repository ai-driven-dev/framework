import { RegisteredToolCatalog } from "../../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { ToolCatalog } from "../../../../src/contexts/tools/contract/tool-catalog.js";
import { REGISTERED_PROFILES } from "../../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import type { BuiltToolConfig } from "../../../../src/contexts/tools/domain/registry.js";

/** A catalog over the given profiles, the registered ones when none is given. Built inside the
 * `it` that reads it: a catalog is a value, never shared state. */
export function catalogOf(profiles: readonly BuiltToolConfig[] = REGISTERED_PROFILES): ToolCatalog {
  return new RegisteredToolCatalog(profiles);
}
