import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CachedTokenProvider } from "../../../../src/contexts/auth/application/cached-token-provider.js";
import { CheckStatus } from "../../../../src/contexts/auth/application/check-status.use-case.js";
import { LogOut } from "../../../../src/contexts/auth/application/log-out.use-case.js";
import { CredentialRecordUnreadableError } from "../../../../src/contexts/auth/contract/auth.error.js";
import { CredentialRecordFileAdapter } from "../../../../src/contexts/auth/infrastructure/credential-record-file-adapter.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryEnvironment } from "../../../shared/testing/in-memory-environment.fake.js";
import { FakeCliAuthProvider } from "../testing/fake-cli-auth-provider.fake.js";
import { FakeIdentityVerifier } from "../testing/fake-identity-verifier.fake.js";

const CORRUPT = "{ not json";
const WRONG_SHAPE = JSON.stringify({ version: 2, token: "ghp_fake" });

describe("a credential record that cannot be read", () => {
  let root: string;
  let records: CredentialRecordFileAdapter;
  const projectFile = (): string => join(root, "project", ".aidd", "auth.json");

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-auth-unreadable-"));
    records = new CredentialRecordFileAdapter(
      join(root, "project"),
      () => join(root, "user"),
      () => new Date(0)
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function plant(content: string): Promise<void> {
    await mkdir(dirname(projectFile()), { recursive: true });
    await writeFile(projectFile(), content, "utf-8");
  }

  it("leaves a missing file as no record", async () => {
    expect(await records.read("project")).toBeNull();
  });

  it.each([
    ["not JSON", CORRUPT],
    ["JSON of another shape", WRONG_SHAPE],
  ])("is refused by name, with its path, when it is %s", async (_label, content) => {
    await plant(content);

    await expect(records.read("project")).rejects.toMatchObject({
      name: "CredentialRecordUnreadableError",
      path: projectFile(),
    });
  });

  it("is refused by name when the system refuses to read it", async () => {
    await mkdir(projectFile(), { recursive: true });

    await expect(records.read("project")).rejects.toBeInstanceOf(CredentialRecordUnreadableError);
  });

  it("is not logged out as absent: the refusal names the file, which stays for the person to delete", async () => {
    await plant(CORRUPT);

    await expect(new LogOut(records).execute()).rejects.toBeInstanceOf(
      CredentialRecordUnreadableError
    );
    expect(await readFile(projectFile(), "utf-8")).toBe(CORRUPT);
  });

  it("is not reported as logged out by the status", async () => {
    await plant(CORRUPT);
    const status = new CheckStatus({
      records,
      environment: new InMemoryEnvironment(),
      identity: new FakeIdentityVerifier(),
      cliProviders: new Map(),
    });

    await expect(status.execute()).rejects.toBeInstanceOf(CredentialRecordUnreadableError);
  });

  it("is not skipped when resolving a token", async () => {
    await plant(CORRUPT);
    const provider = new CachedTokenProvider({
      records,
      supplied: { environment: new InMemoryEnvironment() },
      externalTokens: new FakeCliAuthProvider(),
      logger: new CapturingLogger(),
    });

    await expect(provider.resolve()).rejects.toBeInstanceOf(CredentialRecordUnreadableError);
  });
});
