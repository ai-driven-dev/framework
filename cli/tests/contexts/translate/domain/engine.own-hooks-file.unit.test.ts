import { describe, expect, it } from "vitest";
import { translate } from "../../../../src/contexts/translate/domain/engine.js";
import { aCanon } from "../testing/canon-distribution.builder.js";
import { aStubBuildContract, aSupportedArtifact } from "../testing/stub-build-contract.builder.js";

const HOOKS = `{"hooks":{}}`;

function translated(shared: boolean) {
  const contract = aStubBuildContract();
  return translate(aCanon("plug", { "hooks/hooks.json": HOOKS, "hooks/run.sh": "#!/bin/sh\n" }), {
    kind: "build",
    mode: "flat",
    outDir: "/out",
    contract: {
      ...contract,
      artifacts: {
        ...contract.artifacts,
        hooks: aSupportedArtifact({
          placement: { kind: "hooks", scriptsDir: ".stub/" },
          hooksFile: {
            at: shared ? { shared: ".stub/shared.json" } : { own: ".stub/" },
            merge: (existing, { json, plugin }) => ({
              content: `${existing ?? "none"}+${plugin}:${json}`,
              warnings: ["no equivalent"],
            }),
          },
        }),
      },
    },
  });
}

describe("a flat plugin's hooks file", () => {
  it("is a file of the engine's own when one plugin owns it, with what the merge said", () => {
    const { files, hooks, warnings } = translated(false);
    expect(files.map((file) => file.relativePath)).toContain(".stub/plug.hooks.json");
    expect(files.find((file) => file.relativePath === ".stub/plug.hooks.json")?.content).toBe(
      `none+plug:${HOOKS}`
    );
    expect(hooks).toBeNull();
    expect(warnings).toEqual(["no equivalent"]);
  });

  it("is left to the sink's merge when every plugin shares it", () => {
    const { files, hooks, warnings } = translated(true);
    expect(files.map((file) => file.relativePath)).toEqual([".stub/plug/run.sh"]);
    expect(hooks).toBe(HOOKS);
    expect(warnings).toEqual([]);
  });
});
