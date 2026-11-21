import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeFlatHooks } from "../../../../../src/contexts/translate/application/sinks/flat-hooks-writer.js";
import { FlatTargetExistsError } from "../../../../../src/contexts/translate/domain/translate.error.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  aDiskTarget,
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

const SRC = "/src/plugins/plug";

function stepFor(force: boolean) {
  const artifact = aSupportedArtifact({ path: (_p, rel) => `flat/${rel}` });
  if (!artifact.supported) throw new Error("stub artifact is supported");
  return {
    target: aDiskTarget(aStubBuildContract(), { mode: "flat", force }),
    artifact,
    pluginName: "plug",
    hooksSrc: `${SRC}/hooks/hooks.json`,
    pluginSrc: SRC,
  };
}

function seeded(extra: Record<string, string> = {}): InMemoryFileAdapter {
  return new InMemoryFileAdapter({
    [`${SRC}/hooks/hooks.json`]: "{}",
    [`${SRC}/hooks/run.sh`]: "echo hi",
    ...extra,
  });
}

describe("one plugin's flat hooks", () => {
  it("writes each script beside the hooks file, which it leaves to the tool's own merge", async () => {
    const fs = seeded();
    const count = await writeFlatHooks(fs, new CapturingLogger(), stepFor(false));
    expect(count).toBe(1);
    expect(fs.getFile("/out/flat/hooks/run.sh")).toBe("echo hi");
  });

  it("refuses a script another build already wrote", async () => {
    const fs = seeded({ "/out/flat/hooks/run.sh": "old" });
    await expect(writeFlatHooks(fs, new CapturingLogger(), stepFor(false))).rejects.toThrow(
      new FlatTargetExistsError(join("/out", "flat/hooks/run.sh"), "plug")
    );
  });

  it("overwrites that script when forced", async () => {
    const fs = seeded({ "/out/flat/hooks/run.sh": "old" });
    await writeFlatHooks(fs, new CapturingLogger(), stepFor(true));
    expect(fs.getFile("/out/flat/hooks/run.sh")).toBe("echo hi");
  });
});
