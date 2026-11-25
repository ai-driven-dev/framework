import { execFileSync } from "node:child_process";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { errorMessage } from "../../../shared/domain/describe-error.js";
import { AIDD_DIR } from "../../../shared/domain/layout/aidd-layout.js";
import { AuthStorageError, CredentialRecordUnreadableError } from "../contract/auth.error.js";
import type { AuthLevel, Credential } from "../contract/credential.js";
import {
  type CredentialRecord,
  parseCredentialRecord,
  recordCredential,
} from "../domain/credential-record.js";
import type { CredentialRecordRepository } from "../ports/credential-record-repository.js";

const AUTH_FILE = "auth.json";

/** One `auth.json` per level: the project's under `<root>/.aidd/`, the user's in the user
 * configuration directory. A file is created readable by its owner only. */
export class CredentialRecordFileAdapter implements CredentialRecordRepository {
  constructor(
    private readonly projectRoot: string,
    private readonly userConfigDir: () => string,
    private readonly clock: () => Date
  ) {}

  /** A missing file is no record. One that cannot be read, parsed or accepted is refused with its
   * path: answered as none, a logout would leave its token on disk and a private source would
   * fail later as an authentication error. */
  async read(level: AuthLevel): Promise<CredentialRecord | null> {
    const path = this.pathOf(level);
    let content: string;
    try {
      content = await readFile(path, "utf-8");
    } catch (err) {
      if (isMissing(err)) return null;
      throw new CredentialRecordUnreadableError(path, errorMessage(err));
    }
    let record: CredentialRecord | null;
    try {
      record = parseCredentialRecord(JSON.parse(content));
    } catch (err) {
      throw new CredentialRecordUnreadableError(path, errorMessage(err));
    }
    if (record === null) throw new CredentialRecordUnreadableError(path, "not a credential record");
    return record;
  }

  async save(credential: Credential, level: AuthLevel): Promise<void> {
    await this.write(this.pathOf(level), recordCredential(credential, level, this.clock()));
  }

  async delete(level: AuthLevel): Promise<void> {
    await rm(this.pathOf(level), { force: true });
  }

  private pathOf(level: AuthLevel): string {
    return level === "project"
      ? join(this.projectRoot, AIDD_DIR, AUTH_FILE)
      : join(this.userConfigDir(), AUTH_FILE);
  }

  private async write(path: string, record: CredentialRecord): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(record, null, 2), { encoding: "utf-8", mode: 0o600 });
    await restrictToOwner(path);
  }
}

function isMissing(err: unknown): boolean {
  return err instanceof Error && "code" in err && err.code === "ENOENT";
}

async function restrictToOwner(path: string): Promise<void> {
  if (process.platform !== "win32") {
    await chmod(path, 0o600);
    return;
  }
  try {
    // An argument list, never a command line: `path` comes from an environment variable
    // or a project root, either of which could close the quoting and append a command.
    // With no shell to expand `%USERNAME%`, the account is read here instead.
    execFileSync("icacls", [path, "/inheritance:r", "/grant:r", `${windowsAccount()}:(R,W)`], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (err) {
    throw new AuthStorageError(
      `Failed to set restrictive permissions on ${path}: ${failureDetail(err)}`
    );
  }
}

function failureDetail(err: unknown): string {
  if (err instanceof AuthStorageError) return err.detail;
  return errorMessage(err);
}

/** The account icacls grants to. Absent, the grant would name nobody, so it fails here
 * rather than leaving a credential file with inheritance stripped and no grant at all. */
function windowsAccount(): string {
  const account = process.env.USERNAME;
  if (account === undefined || account === "") {
    throw new AuthStorageError("USERNAME is not set, so no account can be granted access");
  }
  return account;
}
