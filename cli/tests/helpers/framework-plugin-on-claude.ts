import { ModeAMarketplaceTranslator } from "../../src/contexts/installation/application/materialize/mode-a-marketplace-translator.js";
import type { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../src/shared/domain/plugin/plugin-distribution.js";
import { registeredAiProfile, TOOL } from "../contexts/tools/testing/catalog-of.js";

const { claude } = TOOL;
const PROJECT_ROOT = "/test-project";

export const MARKETPLACE_NAME = "aidd-framework";
export const PLUGIN_NAME = "aidd-telemetry";
export const REF = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;

export function buildDist(): PluginDistribution {
  return new PluginDistribution({
    manifest: { name: PLUGIN_NAME, version: "1.0.0" },
    format: claude,
    files: [{ relativePath: "commands/hello.md", content: "# Hello" }],
    components: {
      commands: [{ relativePath: "commands/hello.md", content: "# Hello" }],
      agents: [],
      rules: [],
      skills: [],
      hooks: [],
      mcp: [],
    },
  });
}

export async function installViaModeA(manifest: Manifest): Promise<void> {
  await new ModeAMarketplaceTranslator().addPlugin(
    buildDist(),
    registeredAiProfile(claude),
    { kind: "local", path: "/plugin-source" },
    PROJECT_ROOT,
    manifest,
    MARKETPLACE_NAME
  );
  manifest.setNativeRegistrations(claude, {
    binary: "claude",
    marketplaces: [
      {
        alias: MARKETPLACE_NAME,
        hostName: MARKETPLACE_NAME,
        provenance: { kind: "registry", source: "/plugin-source" },
      },
    ],
    pluginRefs: [REF],
  });
}

export function verifiedSourceReader() {
  return {
    read: async () => ({
      location: "/host/catalogue",
      entries: new Map([
        [MARKETPLACE_NAME, { kind: "registry" as const, source: "/plugin-source" }],
        ["upstream", { kind: "registry" as const, source: "/plugin-source" }],
      ]),
    }),
  };
}
