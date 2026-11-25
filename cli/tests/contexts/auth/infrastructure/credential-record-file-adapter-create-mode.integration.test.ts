import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, chmod: vi.fn(async () => {}) };
});

import { CredentialRecordFileAdapter } from "../../../../src/contexts/auth/infrastructure/credential-record-file-adapter.js";

/** A worker thread, which is where a mutation run executes the tests, refuses to set the mask
 * and keeps the one it inherited: `undefined` then, and nothing to restore. */
function setMask(mask: number): number | undefined {
  try {
    return process.umask(mask);
  } catch {
    return undefined;
  }
}

describe("CredentialRecordFileAdapter, the creation of a credential file", () => {
  let tempDir: string;
  let previousMask: number | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-auth-create-mode-"));
    previousMask = setMask(0o022);
  });

  afterEach(async () => {
    if (previousMask !== undefined) process.umask(previousMask);
    await rm(tempDir, { recursive: true, force: true });
  });

  it.skipIf(process.platform === "win32")(
    "creates the file owner-only, before any permission is restricted afterwards",
    async () => {
      const path = join(tempDir, "auth.json");

      await new CredentialRecordFileAdapter(
        tempDir,
        () => tempDir,
        () => new Date()
      ).save({ method: "stored", token: "ghp_test" }, "user");

      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }
  );
});
