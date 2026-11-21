import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { wireTools } from "../../../src/composition/tools.js";
import { AssetNotFoundError } from "../../../src/shared/domain/errors/asset-not-found-error.js";
import { BundledAssetProviderAdapter } from "../../../src/shared/infrastructure/asset-loader.js";
import { registeredTools, TOOL } from "../testing/registered-tools.builder.js";

const CONFIGS = fileURLToPath(new URL("../../../assets/configs/", import.meta.url));
const catalog = wireTools();
const provider = new BundledAssetProviderAdapter(catalog);

/** A bundled text asset is stored as `<name>.txt`; the loader serves it under `<name>`. */
function shippedBy(toolId: string): string[] {
  const dir = `${CONFIGS}${toolId}`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((file) => file.replace(/\.txt$/, ""));
}

const EVERY_NAME = [
  ...new Set(
    registeredTools()
      .idsInCanonicalOrder()
      .flatMap((id) => shippedBy(id))
  ),
];

describe("config assets per tool", () => {
  it.each(registeredTools().idsInCanonicalOrder())(
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
    expect(provider.loadConfigAsset(TOOL.claude, "settings.json")).toBe(
      catalog.profile(TOOL.claude).configAsset("settings.json")?.content
    );
  });
});
