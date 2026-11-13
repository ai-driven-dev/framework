import { MarketplaceRegistryAdapter } from "../../../../src/contexts/distribution/infrastructure/marketplace-registry-adapter.js";
import { atomicWriteFile } from "../../../../src/runtime/filesystem/atomic-write.js";
import { userConfigDir } from "../../../../src/runtime/user-config-dir.js";

/** The one place a test builds the real registry. Without a directory it follows the
 * environment, as the composition does. */
export function makeRegistryAdapter(configDir?: string): MarketplaceRegistryAdapter {
  return new MarketplaceRegistryAdapter(
    configDir === undefined ? userConfigDir : () => configDir,
    atomicWriteFile
  );
}
