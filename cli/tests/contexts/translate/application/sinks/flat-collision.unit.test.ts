import { describe, expect, it } from "vitest";
import { assertFlatDestinationFree } from "../../../../../src/contexts/translate/application/sinks/flat-collision.js";
import { FlatTargetExistsError } from "../../../../../src/contexts/translate/contract/translate.error.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { aDiskTarget, aStubBuildContract } from "../../testing/stub-build-contract.builder.js";

const DEST = "/out/agents/a.md";

function destination(force: boolean) {
  return {
    target: aDiskTarget(aStubBuildContract(), { mode: "flat", force }),
    destPath: DEST,
    pluginName: "plug",
  };
}

describe("a flat destination another build already wrote", () => {
  it("is free when nothing is there", async () => {
    await expect(
      assertFlatDestinationFree(new InMemoryFileAdapter(), destination(false))
    ).resolves.toBeUndefined();
  });

  it("is refused, naming the file and the plugin, when something is there", async () => {
    const fs = new InMemoryFileAdapter({ [DEST]: "old" });
    await expect(assertFlatDestinationFree(fs, destination(false))).rejects.toThrow(
      new FlatTargetExistsError(DEST, "plug")
    );
  });

  it("is free when forced", async () => {
    const fs = new InMemoryFileAdapter({ [DEST]: "old" });
    await expect(assertFlatDestinationFree(fs, destination(true))).resolves.toBeUndefined();
  });
});
