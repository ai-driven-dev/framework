import { describe, expect, it } from "vitest";
import { loadAddManifests } from "../../../../../../src/contexts/installation/application/plugin/add/load-add-manifests.js";
import { ManifestUnavailableError } from "../../../../../../src/contexts/installation/domain/installation.error.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { InMemoryManifestRepository } from "../../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

function manifestWithClaude(): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  return manifest;
}

describe("loading the manifests an add needs", () => {
  it("returns the project manifest and an empty machine manifest when none is claimed yet", async () => {
    const project = new InMemoryManifestRepository(manifestWithClaude());
    const user = new InMemoryManifestRepository();

    const { manifest, machine } = await loadAddManifests({ project, user }, registeredTools());

    expect(manifest.hasTool(TOOL.claude)).toBe(true);
    expect(machine.hasTool(TOOL.claude)).toBe(false);
  });

  it("returns a copy of the machine manifest it finds", async () => {
    const project = new InMemoryManifestRepository(manifestWithClaude());
    const user = new InMemoryManifestRepository(manifestWithClaude());

    const { machine } = await loadAddManifests({ project, user }, registeredTools());

    expect(machine.hasTool(TOOL.claude)).toBe(true);
  });

  it("refuses an add with no project manifest", async () => {
    const project = new InMemoryManifestRepository();
    const user = new InMemoryManifestRepository();

    await expect(loadAddManifests({ project, user }, registeredTools())).rejects.toThrow(
      ManifestUnavailableError
    );
  });
});
