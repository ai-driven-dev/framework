import { describe, expect, it } from "vitest";
import { generateOpencodeHooksBridge } from "../../../../../../src/contexts/tools/domain/behaviours/opencode/opencode-hooks-bridge.model.js";
import { hooksOf, ROOT } from "../../../testing/bridged-hosts.builder.js";

const STOP_HOOK = hooksOf("Stop", `node ${ROOT}/hooks/a.cjs`);

describe("generating OpenCode's hooks bridge", () => {
  it("exports a descriptor that hands the plugin's server to the shared events adapter", () => {
    const bridge = generateOpencodeHooksBridge(STOP_HOOK, "aidd-test").content;

    expect(bridge).toContain('import { setupOpencodeEvents } from "../hooks/opencode-events.js";');
    expect(bridge).toContain("export const AiddTestHooks = async (input) => {");
    expect(bridge).toContain('id: "aidd-test-hooks"');
    expect(bridge).toContain("setup: (ctx) => setupOpencodeEvents(ctx, AiddTestHooks),");
  });
});
