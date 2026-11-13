import { RegisteredToolCatalog } from "../contexts/tools/application/registered-tool-catalog.js";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import {
  CANONICAL_PROFILES,
  REGISTERED_PROFILES,
} from "../contexts/tools/domain/profiles/registered-profiles.js";

/** The catalog of every registered tool. Pure and root-independent: the composition root builds
 * it once, and each edge that resolves tools holds it. */
export function wireTools(): ToolCatalog {
  return new RegisteredToolCatalog(REGISTERED_PROFILES, CANONICAL_PROFILES);
}
