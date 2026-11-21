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

function stepFor(over: Parameters<typeof aSupportedArtifact>[0] = {}, force = false) {
  const artifact = aSupportedArtifact({ path: (_p, rel) => `flat/${rel}`, ...over });
  if (!artifact.supported) throw new Error("stub artifact is supported");
  return {
    target: aDiskTarget(aStubBuildContract(), { mode: "flat", force }),
    artifact,
    pluginName: "plug",
    hooksSrc: `${SRC}/hooks/hooks.json`,
  };
}

const OWN_FILE = {
  path: (plugin: string) => `flat/${plugin}.json`,
  shared: false,
  merge: (_existing: string | null, shipped: { json: string }) => ({
    content: `merged:${shipped.json}`,
    warnings: [],
  }),
};

function seeded(extra: Record<string, string> = {}): InMemoryFileAdapter {
  return new InMemoryFileAdapter({ [`${SRC}/hooks/hooks.json`]: "{}", ...extra });
}

describe("one plugin's flat hooks file", () => {
  it("writes the merged hooks file", async () => {
    const fs = seeded();
    const count = await writeFlatHooks(fs, new CapturingLogger(), stepFor({ hooksFile: OWN_FILE }));
    expect(count).toBe(1);
    expect(fs.getFile("/out/flat/plug.json")).toBe("merged:{}");
  });

  it("writes nothing for a tool that reads no hooks file", async () => {
    const fs = seeded();
    expect(await writeFlatHooks(fs, new CapturingLogger(), stepFor())).toBe(0);
  });

  it("writes nothing for a tool whose hooks file is skipped for a bridge", async () => {
    const fs = seeded();
    const step = stepFor({ hooksFile: OWN_FILE, skipHooksJson: true });
    expect(await writeFlatHooks(fs, new CapturingLogger(), step)).toBe(0);
  });

  it("refuses its own hooks file another build already wrote", async () => {
    const fs = seeded({ "/out/flat/plug.json": "old" });
    await expect(
      writeFlatHooks(fs, new CapturingLogger(), stepFor({ hooksFile: OWN_FILE }))
    ).rejects.toThrow(new FlatTargetExistsError(join("/out", "flat/plug.json"), "plug"));
  });

  it("overwrites it when forced", async () => {
    const fs = seeded({ "/out/flat/plug.json": "old" });
    await writeFlatHooks(fs, new CapturingLogger(), stepFor({ hooksFile: OWN_FILE }, true));
    expect(fs.getFile("/out/flat/plug.json")).toBe("merged:{}");
  });
});
