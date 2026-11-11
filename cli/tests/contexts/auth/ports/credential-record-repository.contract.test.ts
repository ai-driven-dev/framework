import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CredentialRecordFileAdapter } from "../../../../src/contexts/auth/infrastructure/credential-record-file-adapter.js";
import {
  describeCredentialRecordRepositoryContract,
  type RepositorySubject,
} from "../testing/credential-record-repository-contract.js";
import { InMemoryCredentialRecordRepository } from "../testing/in-memory-credential-record-repository.js";

describeCredentialRecordRepositoryContract(
  "the in-memory repository",
  async (): Promise<RepositorySubject> => ({
    repository: new InMemoryCredentialRecordRepository(),
    dispose: async () => undefined,
  })
);

describeCredentialRecordRepositoryContract(
  "the file adapter on a temp dir",
  async (): Promise<RepositorySubject> => {
    const root = await mkdtemp(join(tmpdir(), "aidd-auth-"));
    return {
      repository: new CredentialRecordFileAdapter(
        join(root, "project"),
        () => join(root, "user"),
        () => new Date(0)
      ),
      dispose: () => rm(root, { recursive: true, force: true }),
    };
  }
);
