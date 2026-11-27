import { describe, expect, it } from "vitest";
import { loadMachineManifest } from "../../../../../src/contexts/installation/application/shared/load-machine-manifest.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";

describe("loading the machine's manifest", () => {
  it("answers an empty manifest when the machine claimed nothing yet", async () => {
    const machine = await loadMachineManifest(new InMemoryManifestRepository());

    expect(machine.getInstalledToolIds()).toStrictEqual([]);
  });
});
