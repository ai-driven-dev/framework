import { describe, expect, it } from "vitest";
import { generateKiloHooksBridge } from "../../../../../../src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.model.js";

const STOP_HOOK = JSON.stringify({
  hooks: { Stop: [{ hooks: [{ command: "node $" + "{CLAUDE_PLUGIN_ROOT}/hooks/a.cjs" }] }] },
});

describe("generateKiloHooksBridge", () => {
  it("exports a descriptor named after the plugin, serving the plugin's own server", () => {
    expect(generateKiloHooksBridge(STOP_HOOK, "aidd-test")).toContain(
      'export default { id: "aidd-test-hooks", server: AiddTestKiloHooks };'
    );
  });

  it("writes no module for a plugin with no replayable hook", () => {
    expect(generateKiloHooksBridge("{}", "aidd-test")).toBeNull();
  });
});
