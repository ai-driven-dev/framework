import { wireTools } from "../../../src/composition/tools.js";
import { BundledAssetProviderAdapter } from "../../../src/shared/infrastructure/asset-loader.js";
import { TOOL } from "../testing/registered-tools.js";
import { describeAssetProviderContract } from "../testing/run-asset-provider-contract.js";
import { StubAssetProvider } from "../testing/stub-asset-provider.js";

const heldAsset = { toolId: TOOL.claude, fileName: "settings.json" };

describeAssetProviderContract("the stub", () => ({
  provider: new StubAssetProvider({
    [`${heldAsset.toolId}/${heldAsset.fileName}`]: { permissions: {} },
  }),
  heldAsset,
}));

describeAssetProviderContract("the bundled assets", () => ({
  provider: new BundledAssetProviderAdapter(wireTools()),
  heldAsset,
}));
