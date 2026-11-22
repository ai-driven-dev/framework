import { describe, expect, it } from "vitest";
import { requireManifest } from "../../../../../src/contexts/installation/application/shared/require-manifest.js";
import { ManifestUnavailableError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";

describe("requiring a project's manifest", () => {
  it("answers the manifest a project holds", async () => {
    const manifest = Manifest.create();

    await expect(requireManifest(new InMemoryManifestRepository(manifest))).resolves.toBe(manifest);
  });

  it("names a project with no manifest by a stable code", async () => {
    const failure = await requireManifest(new InMemoryManifestRepository()).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(ManifestUnavailableError);
    expect((failure as ManifestUnavailableError).code).toBe("manifest-missing");
  });

  it("lets a manifest that cannot be read surface as it was raised", async () => {
    const unreadable = new Error("/p/.aidd/manifest.json is not valid JSON: Unexpected token");
    const repo = new (class extends InMemoryManifestRepository {
      async load(): Promise<never> {
        throw unreadable;
      }
    })();

    await expect(requireManifest(repo)).rejects.toBe(unreadable);
  });
});
