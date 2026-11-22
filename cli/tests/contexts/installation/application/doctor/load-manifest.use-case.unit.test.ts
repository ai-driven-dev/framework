import { describe, expect, it } from "vitest";
import { LoadManifest } from "../../../../../src/contexts/installation/application/doctor/load-manifest.use-case.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";

describe("loading a project's manifest", () => {
  it("answers the manifest a project holds", async () => {
    const manifest = Manifest.create();

    await expect(
      new LoadManifest(new InMemoryManifestRepository(manifest)).execute()
    ).resolves.toBe(manifest);
  });

  it("names a project with no manifest by a stable code", async () => {
    await expect(
      new LoadManifest(new InMemoryManifestRepository()).execute()
    ).rejects.toMatchObject({ code: "manifest-missing" });
  });
});
