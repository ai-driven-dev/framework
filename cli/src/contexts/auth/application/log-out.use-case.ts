import type { AuthLevel } from "../contract/credential.js";
import {
  LEVELS_BY_PRECEDENCE,
  type RemovalHint,
  removalHint,
} from "../domain/credential-record.js";
import type { CredentialRecordRepository } from "../ports/credential-record-repository.js";

export type LogOutResult = { found: false } | { found: true; level: AuthLevel; hint?: RemovalHint };

/** Removes the first record in the order of levels, the one that answers for this project. */
export class LogOut {
  constructor(private readonly records: CredentialRecordRepository) {}

  async execute(): Promise<LogOutResult> {
    for (const level of LEVELS_BY_PRECEDENCE) {
      const record = await this.records.read(level);
      if (record === null) continue;
      await this.records.delete(level);
      return { found: true, level: record.level, hint: removalHint(record) };
    }
    return { found: false };
  }
}
