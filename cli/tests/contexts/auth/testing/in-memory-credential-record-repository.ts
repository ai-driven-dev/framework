import type { AuthLevel, Credential } from "../../../../src/contexts/auth/contract/credential.js";
import {
  type CredentialRecord,
  recordCredential,
} from "../../../../src/contexts/auth/domain/credential-record.js";
import type { CredentialRecordRepository } from "../../../../src/contexts/auth/ports/credential-record-repository.js";

/** Keeps one record per level, as records, never as text: an unreadable file is the file
 * adapter's case, not the port's. */
export class InMemoryCredentialRecordRepository implements CredentialRecordRepository {
  private readonly records = new Map<AuthLevel, CredentialRecord>();
  /** Every level read, in order, so a test can see which records a caller reached. */
  readonly reads: AuthLevel[] = [];

  constructor(private readonly clock: () => Date = () => new Date(0)) {}

  /** Places a record at a level as it was found there, whatever level it names itself. */
  seed(level: AuthLevel, record: CredentialRecord): this {
    this.records.set(level, record);
    return this;
  }

  async read(level: AuthLevel): Promise<CredentialRecord | null> {
    this.reads.push(level);
    return this.records.get(level) ?? null;
  }

  async save(credential: Credential, level: AuthLevel): Promise<void> {
    this.records.set(level, recordCredential(credential, level, this.clock()));
  }

  async delete(level: AuthLevel): Promise<void> {
    this.records.delete(level);
  }
}
