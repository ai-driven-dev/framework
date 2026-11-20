import { describe, expect, it } from "vitest";
import { LoadManifest } from "../../../../../src/contexts/installation/application/doctor/load-manifest.js";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import type { ManifestRepository } from "../../../../../src/contexts/installation/ports/manifest-repository.js";
import { ManifestUnavailableError } from "../../../../../src/shared/domain/errors.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";

function failingWith(error: Error): ManifestRepository {
  return new (class extends InMemoryManifestRepository {
    async load(): Promise<never> {
      throw error;
    }
  })();
}

describe("LoadManifest", () => {
  it("answers the manifest a project holds", async () => {
    const manifest = Manifest.create();

    await expect(
      new LoadManifest(new InMemoryManifestRepository(manifest)).execute()
    ).resolves.toBe(manifest);
  });

  it("names a project with no manifest by a stable code", async () => {
    await expect(
      new LoadManifest(new InMemoryManifestRepository()).execute()
    ).rejects.toMatchObject({
      code: "manifest-missing",
      message: "No AIDD manifest found. Run `aidd setup` to initialize your project.",
    });
  });

  it.each([
    ["a file that is not JSON", new SyntaxError("Unexpected token")],
    ["a file the schema refuses", new Error('Invalid MD5 hash: "abc"')],
    ["a file that cannot be read", Object.assign(new Error("EACCES"), { code: "EACCES" })],
  ])("names %s as a corrupted manifest", async (_name, cause) => {
    const failure = await new LoadManifest(failingWith(cause)).execute().catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ManifestUnavailableError);
    expect((failure as ManifestUnavailableError).cause).toBe(cause);
    expect(failure).toMatchObject({
      code: "manifest-corrupted",
      message: "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize.",
    });
  });
});
