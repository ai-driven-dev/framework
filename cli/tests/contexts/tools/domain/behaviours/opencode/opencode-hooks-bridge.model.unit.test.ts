import { describe, expect, it } from "vitest";
import { generateOpencodeHooksBridge } from "../../../../../../src/contexts/tools/domain/behaviours/opencode/opencode-hooks-bridge.model.js";

const STOP_HOOK = JSON.stringify({
  hooks: { Stop: [{ hooks: [{ command: "node $" + "{CLAUDE_PLUGIN_ROOT}/hooks/a.cjs" }] }] },
});

describe("generating OpenCode's hooks bridge", () => {
  it("exports a descriptor that hands the plugin's server to the shared events adapter", () => {
    const bridge = generateOpencodeHooksBridge(STOP_HOOK, "aidd-test");

    expect(bridge).toContain('import { setupOpencodeEvents } from "../hooks/opencode-events.js";');
    expect(bridge).toContain("export const AiddTestHooks = async (input) => {");
    expect(bridge).toContain('id: "aidd-test-hooks"');
    expect(bridge).toContain("setup: (ctx) => setupOpencodeEvents(ctx, AiddTestHooks),");
  });

  it("writes no module for a plugin with no replayable hook", () => {
    expect(generateOpencodeHooksBridge("{}", "aidd-test")).toBeNull();
  });
});
