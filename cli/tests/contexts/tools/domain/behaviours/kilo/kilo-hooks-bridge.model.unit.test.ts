import { describe, expect, it } from "vitest";
import { generateKiloHooksBridge } from "../../../../../../src/contexts/tools/domain/behaviours/kilo/kilo-hooks-bridge.model.js";
import { hooksOf, ROOT } from "../../../testing/event-bridge-host.builder.js";

const STOP_HOOK = hooksOf("Stop", `node ${ROOT}/hooks/a.cjs`);

describe("generating Kilo's hooks bridge", () => {
  it("exports a descriptor named after the plugin, serving the plugin's own server", () => {
    expect(generateKiloHooksBridge(STOP_HOOK, "aidd-test").content).toContain(
      'export default { id: "aidd-test-hooks", server: AiddTestKiloHooks };'
    );
  });
});
