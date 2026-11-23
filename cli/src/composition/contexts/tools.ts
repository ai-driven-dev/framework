import { RegisteredToolCatalog } from "../../contexts/tools/application/registered-tool-catalog.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import { REGISTERED_PROFILES, type RegisteredAiProfile } from "../tool-profiles.composition.js";

/** The catalog the composition hands every edge: its AI profiles answer their native registration. */
export type RegisteredCatalog = ToolCatalog<RegisteredAiProfile>;

/** The catalog of every registered tool. Pure and root-independent: the composition root builds
 * it once, and each edge that resolves tools holds it. */
export function wireTools(): RegisteredCatalog {
  return new RegisteredToolCatalog<RegisteredAiProfile>(REGISTERED_PROFILES);
}
