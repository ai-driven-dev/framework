import { describe, expect, it } from "vitest";
import { translate } from "../../../../src/contexts/translate/domain/engine.js";
import { aCanon } from "../testing/canon-distribution.builder.js";
import { aStubBuildContract, aSupportedArtifact } from "../testing/stub-build-contract.builder.js";

const hooksOf = (...events: string[]) =>
  JSON.stringify({ hooks: Object.fromEntries(events.map((event) => [event, []])) });

function translated(files: Record<string, string>) {
  const contract = aStubBuildContract();
  return translate(aCanon("plug", files), {
    kind: "build",
    mode: "flat",
    outDir: "/out",
    contract: {
      ...contract,
      artifacts: {
        ...contract.artifacts,
        hooks: aSupportedArtifact({
          placement: { kind: "hooks", scriptsDir: ".stub/" },
          skipHooksJson: true,
          hooksBridge: {
            generate: () => "bridge",
            dir: ".stub/plugin/",
            skipIfSourceHas: "own.js",
            tool: "stub",
            unrelayed: (raw: string) =>
              Object.keys(JSON.parse(raw).hooks ?? {}).filter((event) => event !== "Stop"),
          },
        }),
      },
    },
  });
}

describe("a flat build of a plugin whose hooks a bridge replays", () => {
  it("warns of each event the bridge does not relay", () => {
    const { warnings } = translated({ "hooks/hooks.json": hooksOf("Stop", "SessionEnd") });

    expect(warnings).toEqual(["stub: unmapped event 'SessionEnd' skipped"]);
  });

  it("says nothing of an event it relays", () => {
    expect(translated({ "hooks/hooks.json": hooksOf("Stop") }).warnings).toEqual([]);
  });

  it("says nothing when the plugin ships the bridge itself", () => {
    const { warnings } = translated({
      "hooks/hooks.json": hooksOf("SessionEnd"),
      "hooks/own.js": "export {}",
    });

    expect(warnings).toEqual([]);
  });

  it("says nothing for a plugin with no hooks manifest", () => {
    expect(translated({ "hooks/run.sh": "#!/bin/sh\n" }).warnings).toEqual([]);
  });
});
