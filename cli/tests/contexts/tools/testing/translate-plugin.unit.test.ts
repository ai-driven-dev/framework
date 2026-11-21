import { describe, expect, it } from "vitest";
import { codexProfile } from "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { SmolTomlCodec } from "../../../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { translatePlugin } from "./translate-plugin.builder.js";

const codex = codexProfile(new SmolTomlCodec());

const BARE_MANIFEST = "plugin.json";
const SHALLOW_MANIFEST = ".claude-plugin/plugin.json";
const DEEPEST_MANIFEST = ".github/plugin/plugin.json";

function distributionCarrying(manifests: readonly string[]): PluginDistribution {
  const files = manifests.map((relativePath) => ({ relativePath, content: relativePath }));
  return new PluginDistribution({
    manifest: { name: "sample-plugin", version: "1.0.0" },
    format: TOOL.claude,
    files,
    components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
  });
}

describe("translatePlugin", () => {
  // Order is behaviour: the translation carries the first manifest a probe finds, and the
  // composition probes the deepest path first.
  it("carries the deepest manifest the distribution holds, as the composition probes", () => {
    const distribution = distributionCarrying([BARE_MANIFEST, SHALLOW_MANIFEST, DEEPEST_MANIFEST]);

    const { files } = translatePlugin(distribution, codex);

    expect(files.find((file) => file.relativePath.endsWith("plugin.json"))?.content).toBe(
      DEEPEST_MANIFEST
    );
  });
});
