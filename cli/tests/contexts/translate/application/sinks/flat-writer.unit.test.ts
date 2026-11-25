import { describe, expect, it } from "vitest";
import { FlatWriter } from "../../../../../src/contexts/translate/application/sinks/flat-writer.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { aDiskTarget, aStubBuildContract } from "../../testing/stub-build-contract.builder.js";

describe("the flat config artefact", () => {
  it("writes nothing when the tool declares none", async () => {
    const fs = new InMemoryFileAdapter();
    const writer = new FlatWriter(
      fs,
      {
        loadConfigAsset: () => {
          throw new Error("not used");
        },
      },
      new CapturingLogger()
    );
    const target = aDiskTarget(aStubBuildContract(), { mode: "flat" });
    await expect(writer.writeConfig(target, [{ name: "plug" }])).resolves.toBe(0);
    expect(fs.listUnder("/out")).toEqual([]);
  });
});
