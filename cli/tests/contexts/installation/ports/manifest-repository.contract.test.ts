import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ManifestRepositoryAdapter } from "../../../../src/contexts/installation/infrastructure/manifest-repository-adapter.js";
import { resolveRegisteredToolId } from "../../../shared/testing/registered-tools.builder.js";
import { InMemoryManifestRepository } from "../testing/in-memory-manifest-repository.js";
import {
  describeManifestRepositoryContract,
  type ManifestRepositorySubject,
} from "../testing/manifest-repository-contract.js";

const FAKE_ROOT = "/test-project";

describeManifestRepositoryContract(
  "the in-memory repository",
  async (): Promise<ManifestRepositorySubject> => ({
    repository: new InMemoryManifestRepository(null, FAKE_ROOT),
    projectRoot: FAKE_ROOT,
    dispose: async () => undefined,
  })
);

describeManifestRepositoryContract(
  "the file adapter on a temp dir",
  async (): Promise<ManifestRepositorySubject> => {
    const projectRoot = await mkdtemp(join(tmpdir(), "aidd-manifest-repo-"));
    return {
      repository: new ManifestRepositoryAdapter(projectRoot, resolveRegisteredToolId),
      projectRoot,
      dispose: () => rm(projectRoot, { recursive: true, force: true }),
    };
  }
);
