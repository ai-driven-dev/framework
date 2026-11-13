import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import { AssetNotFoundError } from "../../../src/kernel/errors.js";
import { BundledAssetProviderAdapter } from "../../../src/runtime/assets/asset-loader.js";

const CONFIGS = fileURLToPath(new URL("../../../assets/configs/", import.meta.url));
const provider = new BundledAssetProviderAdapter();

/** A bundled text asset is stored as `<name>.txt`; the loader serves it under `<name>`. */
function shippedBy(toolId: string): string[] {
  const dir = `${CONFIGS}${toolId}`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((file) => file.replace(/\.txt$/, ""));
}

const EVERY_NAME = [...new Set(REGISTERED_PROFILES.flatMap((p) => shippedBy(p.toolId)))];

describe("BundledAssetProviderAdapter config assets per tool", () => {
  it.each(REGISTERED_PROFILES.map((profile) => profile.toolId))(
    "yields exactly the config assets bundled for %s",
    (toolId) => {
      const own = shippedBy(toolId);
      for (const name of EVERY_NAME) {
        const load = () => provider.loadConfigAsset(toolId, name);
        if (own.includes(name)) expect(load).not.toThrow();
        else expect(load).toThrow(AssetNotFoundError);
      }
    }
  );
});
