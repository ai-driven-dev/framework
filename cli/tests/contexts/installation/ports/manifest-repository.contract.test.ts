import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ManifestRepositoryAdapter } from "../../../../src/contexts/installation/infrastructure/manifest-repository-adapter.js";
import { UserManifestRepositoryAdapter } from "../../../../src/contexts/installation/infrastructure/user-manifest-repository-adapter.js";
import { atomicWriteFile } from "../../../../src/shared/infrastructure/atomic-write.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import { manifestFileDeps } from "../testing/manifest-file-deps.builder.js";
import {
  describeManifestFileContract,
  describeManifestRepositoryContract,
  type ManifestFileSubject,
} from "../testing/manifest-repository.contract.js";

const FAKE_ROOT = "/test-project";

describeManifestRepositoryContract("the in-memory repository", async () => ({
  repository: new InMemoryManifestRepository(null, FAKE_ROOT),
  manifestPath: `${FAKE_ROOT}/.aidd/manifest.json`,
  dispose: async () => undefined,
}));

async function projectFile(): Promise<ManifestFileSubject> {
  const root = await mkdtemp(join(tmpdir(), "aidd-manifest-repo-"));
  const open = (writer = atomicWriteFile) =>
    new ManifestRepositoryAdapter(
      root,
      manifestFileDeps(() => join(root, ".aidd"), writer)
    );
  return {
    repository: open(),
    manifestPath: join(root, ".aidd", "manifest.json"),
    refusal: { location: "in this project", reinstall: "aidd setup" },
    reopen: open,
    dispose: () => rm(root, { recursive: true, force: true }),
  };
}

async function userFile(): Promise<ManifestFileSubject> {
  const dir = await mkdtemp(join(tmpdir(), "aidd-user-manifest-repo-"));
  const open = (writer = atomicWriteFile) =>
    new UserManifestRepositoryAdapter(
      () => dir,
      manifestFileDeps(() => dir, writer)
    );
  return {
    repository: open(),
    manifestPath: join(dir, "manifest.json"),
    refusal: { location: "for this machine", reinstall: "aidd setup --global" },
    reopen: open,
    dispose: () => rm(dir, { recursive: true, force: true }),
  };
}

describeManifestRepositoryContract("the project file adapter", projectFile);
describeManifestRepositoryContract("the user file adapter", userFile);
describeManifestFileContract("the project file adapter's", projectFile);
describeManifestFileContract("the user file adapter's", userFile);
