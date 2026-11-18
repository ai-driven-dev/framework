import { wireTools } from "../../../src/composition/tools.js";
import { BundledAssetProviderAdapter } from "../../../src/contexts/installation/infrastructure/assets/asset-loader.js";
import type { AssetProvider } from "../../../src/shared/ports/asset-provider.js";

/** The schemas and config assets the CLI ships, read as the composition root reads them: for a
 * test of another context that builds a real tree and owns no asset loader. */
export function bundledAssetProvider(): AssetProvider {
  return new BundledAssetProviderAdapter(wireTools());
}
