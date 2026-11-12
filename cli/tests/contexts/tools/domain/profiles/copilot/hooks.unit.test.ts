import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../../src/contexts/tools/domain/build-contract.js";
import { buildCopilotFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/copilot/build.js";

describe("a matcher group that declares no hooks list", () => {
  const groupless = JSON.stringify({
    hooks: { Stop: [{ matcher: "x" }, { hooks: [{ command: "a" }] }] },
  });

  it("is skipped by the Copilot flattening", () => {
    const hooks: ArtifactContract = buildCopilotFlatContract().artifacts.hooks;
    if (!hooks.supported || hooks.hooksFile === undefined) throw new Error("no hooks file");

    expect(
      JSON.parse(hooks.hooksFile.merge(null, groupless, "p", (path) => path).content)
    ).toStrictEqual({
      version: 1,
      hooks: { Stop: [{ type: "command", command: "a" }] },
    });
  });
});
