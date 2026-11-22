import type { ConfigAsset } from "../../../src/shared/domain/reading/config-asset.js";
import { BundledAssetProviderAdapter } from "../../../src/shared/infrastructure/asset-loader.js";
import { describeAssetProviderContract } from "../testing/run-asset-provider.contract.js";
import { StubAssetProvider } from "../testing/stub-asset-provider.fake.js";
import { SYNTHETIC_TOOL } from "../testing/synthetic-tool-id.builder.js";

const heldAsset = { toolId: SYNTHETIC_TOOL, fileName: "settings.json" };
const HELD_CONTENT: ConfigAsset = { permissions: {} };

describeAssetProviderContract("the stub", () => ({
  provider: new StubAssetProvider({
    [`${heldAsset.toolId}/${heldAsset.fileName}`]: HELD_CONTENT,
  }),
  heldAsset,
}));

describeAssetProviderContract("the bundled assets", () => ({
  provider: new BundledAssetProviderAdapter({
    profile: () => ({
      configAsset: (name) => (name === heldAsset.fileName ? { content: HELD_CONTENT } : undefined),
    }),
  }),
  heldAsset,
}));
