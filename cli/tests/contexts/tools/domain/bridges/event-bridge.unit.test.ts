import { describe, expect, it } from "vitest";
import { generateKiloHooksBridge } from "../../../../../src/contexts/tools/domain/behaviours/kilo/kilo-hooks-bridge.model.js";
import { generateOpencodeHooksBridge } from "../../../../../src/contexts/tools/domain/behaviours/opencode/opencode-hooks-bridge.model.js";
import { pascalCasePluginName } from "../../../../../src/contexts/tools/domain/bridges/event-bridge.js";

const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
const hooksOf = (event: string, ...commands: (string | undefined)[]) =>
  JSON.stringify({
    hooks: { [event]: [{ hooks: commands.map((command) => ({ type: "command", command })) }] },
  });

describe("naming a plugin in Pascal case", () => {
  it.each([
    ["aidd-sample", "AiddSample"],
    ["aidd--sample", "AiddSample"],
  ])("writes %s as %s", (plugin, stem) => {
    expect(pascalCasePluginName(plugin)).toBe(stem);
  });
});

describe.each([
  ["OpenCode", generateOpencodeHooksBridge],
  ["Kilo", generateKiloHooksBridge],
])("the bridge generator of %s", (_host, generate) => {
  it("writes no module for a hooks.json no mapped event of which is replayable", () => {
    expect(generate(hooksOf("Stop", `${ROOT}/hooks/a.sh`), "aidd-test")).toBeNull();
    expect(generate(hooksOf("SessionEnd", `node ${ROOT}/hooks/a.cjs`), "aidd-test")).toBeNull();
  });

  it.each(["SessionStart", "Stop", "PostToolUse", "PreToolUse", "UserPromptSubmit"])(
    "writes a module for %s alone",
    (event) => {
      expect(generate(hooksOf(event, `node ${ROOT}/hooks/a.cjs`), "aidd-test")).not.toBeNull();
    }
  );
});
