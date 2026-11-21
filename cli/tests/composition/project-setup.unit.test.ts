import { describe, expect, it } from "vitest";
import { projectSetupOf } from "../../src/composition/installation.js";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { InMemoryManifestRepository } from "../shared/testing/in-memory-manifest-repository.fake.js";

describe("a project counts as set up", () => {
  it("once the installation has recorded a manifest for it", async () => {
    const setup = projectSetupOf(new InMemoryManifestRepository(Manifest.create()));

    expect(await setup.isSetUp()).toBe(true);
  });

  it("not while no manifest is recorded", async () => {
    const setup = projectSetupOf(new InMemoryManifestRepository(null));

    expect(await setup.isSetUp()).toBe(false);
  });
});
