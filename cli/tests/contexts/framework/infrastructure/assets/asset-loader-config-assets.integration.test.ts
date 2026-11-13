import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { wireTools } from "../../../../../src/composition/tools.js";
import { BundledAssetProviderAdapter } from "../../../../../src/contexts/framework/infrastructure/assets/asset-loader.js";
import { REGISTERED_PROFILES } from "../../../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import { AssetNotFoundError } from "../../../../../src/shared/domain/errors.js";

const CONFIGS = fileURLToPath(new URL("../../../assets/configs/", import.meta.url));
const catalog = wireTools();
const provider = new BundledAssetProviderAdapter(catalog);

/** A bundled text asset is stored as `<name>.txt`; the loader serves it under `<name>`. */
function shippedBy(toolId: string): string[] {
  const dir = `${CONFIGS}${toolId}`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((file) => file.replace(/\.txt$/, ""));
}

const EVERY_NAME = [...new Set(REGISTERED_PROFILES.flatMap((p) => shippedBy(p.toolId)))];

describe("config assets per tool", () => {
  it.each(REGISTERED_PROFILES.map((profile) => profile.toolId))(
    "the provider yields what %s declares and refuses the rest",
    (toolId) => {
      const own = shippedBy(toolId);
      for (const name of EVERY_NAME) {
        const load = () => provider.loadConfigAsset(toolId, name);
        if (own.includes(name)) expect(load).not.toThrow();
        else expect(load).toThrow(AssetNotFoundError);
      }
    }
  );

  it("serves the asset the profile declares, by identity", () => {
    expect(provider.loadConfigAsset("claude", "settings.json")).toBe(
      catalog.profile("claude").configAsset("settings.json")?.content
    );
  });
});
