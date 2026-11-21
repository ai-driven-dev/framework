import { describe, expect, it } from "vitest";
import { removeAiddState } from "../../../../../src/contexts/installation/application/removal/remove-aidd-state.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { aManifest } from "../../testing/manifest.builder.js";

const ROOT = "/project";

function removal(seed: Record<string, string>) {
  const fs = new InMemoryFileAdapter(seed, [ROOT]);
  const logger = new CapturingLogger();
  const manifestRepo = new InMemoryManifestRepository(aManifest().build(), ROOT);
  return { fs, logger, manifestRepo, deps: { fs, logger, manifestRepo } };
}

describe("removeAiddState", () => {
  it("deletes the manifest and the marketplace registry it wrote", async () => {
    const { deps, manifestRepo, fs } = removal({ "/project/.aidd/marketplaces.json": "{}" });

    await removeAiddState(deps, ROOT);

    expect(await manifestRepo.load()).toBeNull();
    expect(await fs.fileExists("/project/.aidd/marketplaces.json")).toBe(false);
  });

  it("keeps the committed config and says so", async () => {
    const { deps, fs, logger } = removal({ "/project/.aidd/config.json": "{}" });

    await removeAiddState(deps, ROOT);

    expect(await fs.fileExists("/project/.aidd/config.json")).toBe(true);
    expect(logger.infoMessages.join("\n")).toContain("Kept .aidd/config.json");
  });
});
