import { registerMarketplacePlugin } from "../../../../src/contexts/installation/application/materialize/register-marketplace-plugin.js";
import type { ToolRecords } from "../../../../src/contexts/installation/contract/records/scope-records.js";
import type { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";

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

/** Installs the plugin into `manifest` as mode A does, recording its registration in `records`. */
export async function installViaModeA(manifest: Manifest, records: ToolRecords): Promise<void> {
  await registerMarketplacePlugin({
    dist: buildDist(),
    tool: registeredTools().aiProfile(claude),
    source: { kind: "local", path: "/plugin-source" },
    projectRoot: PROJECT_ROOT,
    manifest,
    marketplace: MARKETPLACE_NAME,
  });
  records.set(claude, {
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
