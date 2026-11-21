import type { CredentialRecord } from "../../../../src/contexts/auth/domain/credential-record.js";

const CREATED_AT = "1970-01-01T00:00:00.000Z";

/** A record keeping its own token, at the user level unless a test says otherwise. */
export function aStoredRecord(overrides: Partial<CredentialRecord> = {}): CredentialRecord {
  return {
    version: 1,
    method: "stored",
    level: "user",
    token: "ghp_stored",
    createdAt: CREATED_AT,
    ...overrides,
  };
}

/** A record naming the provider to ask, at the user level unless a test says otherwise. */
export function anExternalRecord(overrides: Partial<CredentialRecord> = {}): CredentialRecord {
  return {
    version: 1,
    method: "external",
    level: "user",
    provider: "gh",
    createdAt: CREATED_AT,
    ...overrides,
  };
}
