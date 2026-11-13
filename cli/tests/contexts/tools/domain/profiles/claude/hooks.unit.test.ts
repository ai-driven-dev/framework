import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../../src/contexts/tools/contract/build-contract.js";
import { buildClaudeFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/claude/build.js";

function merge(pluginHooks: string): unknown {
  const hooks: ArtifactContract = buildClaudeFlatContract().artifacts.hooks;
  if (!hooks.supported || hooks.hooksFile === undefined) throw new Error("no hooks file");
  return JSON.parse(hooks.hooksFile.merge(null, pluginHooks, "p", (path) => path).content);
}

describe("what a plugin ships, merged into .claude/settings.json", () => {
  it("keeps a hook that runs no command, and every key of its group", () => {
    const group = {
      matcher: "Write",
      label: "review",
      hooks: [
        { type: "prompt", prompt: "check" },
        { type: "agent", agent: "reviewer" },
      ],
    };

    expect(merge(JSON.stringify({ hooks: { PostToolUse: [group] } }))).toStrictEqual({
      hooks: { PostToolUse: [group] },
    });
  });
});
