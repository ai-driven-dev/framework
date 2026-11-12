import { pluginManifestProbes } from "../../../../src/contexts/translate/domain/plugin-format.js";
import { catalogOf } from "../../tools/testing/catalog-of.js";

/** Where a plugin manifest can sit across the registered tools, as the composition hands them
 * to the reader. */
export function registeredManifestProbes() {
  return pluginManifestProbes(catalogOf());
}
