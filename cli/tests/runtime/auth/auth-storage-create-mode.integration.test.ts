import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, chmod: vi.fn(async () => {}) };
});

import { AuthStorage } from "../../../src/runtime/auth/auth-storage.js";
import { makeAuthConfig } from "../../helpers/auth.js";

describe("AuthStorage, the creation of a credential file", () => {
  let tempDir: string;
  let previousMask: number;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-auth-create-mode-"));
    previousMask = process.umask(0o022);
  });

  afterEach(async () => {
    process.umask(previousMask);
    await rm(tempDir, { recursive: true, force: true });
  });

  it.skipIf(process.platform === "win32")(
    "creates the file owner-only, before any permission is restricted afterwards",
    async () => {
      const path = join(tempDir, "auth.json");

      await new AuthStorage().write(path, makeAuthConfig());

      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }
  );
});
