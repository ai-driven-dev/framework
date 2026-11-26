import { describe, expect, it } from "vitest";
import { writeFlatHooks } from "../../../../../src/contexts/translate/application/sinks/flat-hooks-writer.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  aDiskTarget,
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

function stepFor(over: Parameters<typeof aSupportedArtifact>[0] = {}) {
  const artifact = aSupportedArtifact({
    placement: { kind: "hooks", scriptsDir: "flat/hooks/" },
    ...over,
  });
  if (!artifact.supported) throw new Error("stub artifact is supported");
  return {
    target: aDiskTarget(aStubBuildContract(), { mode: "flat", force: false }),
    artifact,
    pluginName: "plug",
    hooksJson: "{}",
    carriesRelease: false,
  };
}

const OWN_FILE = {
  at: { own: "flat/" },
  merge: (_existing: string | null, shipped: { json: string }) => ({
    content: `merged:${shipped.json}`,
    warnings: [],
  }),
};

function seeded(extra: Record<string, string> = {}): InMemoryFileAdapter {
  return new InMemoryFileAdapter(extra);
}

describe("one plugin's flat hooks file", () => {
  it("writes the merged hooks file of a tool every plugin shares", async () => {
    const fs = seeded();
    const shared = { ...OWN_FILE, at: { shared: "flat/all.json" } };
    const count = await writeFlatHooks(fs, new CapturingLogger(), stepFor({ hooksFile: shared }));
    expect(count).toBe(1);
    expect(fs.getFile("/out/flat/all.json")).toBe("merged:{}");
  });

  it("writes nothing for a hooks file one plugin owns: the engine lists it", async () => {
    const fs = seeded();
    const count = await writeFlatHooks(fs, new CapturingLogger(), stepFor({ hooksFile: OWN_FILE }));
    expect(count).toBe(0);
    expect(fs.getFile("/out/flat/plug.json")).toBeUndefined();
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
});
