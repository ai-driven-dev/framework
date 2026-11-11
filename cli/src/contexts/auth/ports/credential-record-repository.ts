import type { AuthLevel, Credential } from "../contract/credential.js";
import type { CredentialRecord } from "../domain/credential-record.js";

/** The records of the two levels, each read, saved and deleted by its level alone. */
export interface CredentialRecordRepository {
  read(level: AuthLevel): Promise<CredentialRecord | null>;
  save(credential: Credential, level: AuthLevel): Promise<void>;
  delete(level: AuthLevel): Promise<void>;
}
