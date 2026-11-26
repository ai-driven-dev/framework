import { describe, expect, it } from "vitest";
import { flatHooks } from "../../../../../src/contexts/translate/domain/layouts/build-flat-hooks.js";
import type { SupportedArtifact } from "../../../../../src/shared/domain/materialization/build-contract.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";

const bridged = (skipHooksJson: boolean): SupportedArtifact => ({
  supported: true,
  source: { kind: "fullTree", srcDir: "." },
  placement: { kind: "hooks", scriptsDir: ".stub/" },
  skipHooksJson,
  hooksBridge: {
    generate: () => ({ content: "bridge", warnings: ["unrelayed"] }),
    warning: (reason) => `stub: ${reason}`,
    dir: ".stub/plugin/",
    skipIfSourceHas: "own.js",
  },
});

const canon = aCanon("plug", { "hooks/hooks.json": JSON.stringify({ hooks: { Stop: [] } }) });

describe("the hooks of a flat build", () => {
  it("words each warning of the bridge that replays them in the tool's own terms", () => {
    expect(flatHooks(canon, bridged(true)).warnings).toEqual(["stub: unrelayed"]);
  });

  it("warns of nothing where the tool reads the hooks file itself and no bridge runs", () => {
    expect(flatHooks(canon, bridged(false)).warnings).toEqual([]);
  });
});
