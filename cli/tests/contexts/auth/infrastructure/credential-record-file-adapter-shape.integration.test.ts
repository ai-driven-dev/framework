import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CredentialRecordFileAdapter } from "../../../../src/contexts/auth/infrastructure/credential-record-file-adapter.js";
import { AuthStorageError } from "../../../../src/kernel/errors.js";
import { aStoredRecord } from "../testing/credential-records.js";

describe("CredentialRecordFileAdapter, the shape of a record", () => {
  let tempDir: string;
  let path: string;
  let storage: CredentialRecordFileAdapter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-auth-shape-"));
    path = join(tempDir, "auth.json");
    storage = new CredentialRecordFileAdapter(
      tempDir,
      () => tempDir,
      () => new Date()
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it.each([
    ["null", "null"],
    ["a string", '"ghp_x"'],
    ["a number", "1"],
    ["an array", "[]"],
    ["another version", JSON.stringify({ ...aStoredRecord(), version: 2 })],
    ["an unknown method", JSON.stringify({ ...aStoredRecord(), method: "gh" })],
    ["an unknown level", JSON.stringify({ ...aStoredRecord(), level: "global" })],
    ["no createdAt", JSON.stringify({ ...aStoredRecord(), createdAt: undefined })],
  ])("reads %s as no record at all", async (_shape, content) => {
    await writeFile(path, content);

    expect(await storage.read("user")).toBeNull();
  });

  it("reads back exactly what it wrote, pretty-printed", async () => {
    await storage.save({ method: "stored", token: "ghp_x" }, "user");

    expect(await readFile(path, "utf-8")).toBe(JSON.stringify(await storage.read("user"), null, 2));
  });

  it("records an external credential with its provider and no token", async () => {
    await storage.save({ method: "external", provider: "gh" }, "user");

    const written = JSON.parse(await readFile(path, "utf-8")) as Record<string, unknown>;
    expect(written).toStrictEqual({
      version: 1,
      method: "external",
      level: "user",
      createdAt: written.createdAt,
      provider: "gh",
    });
  });

  it("records a stored credential with its token and no provider", async () => {
    await storage.save({ method: "stored", token: "ghp_x" }, "user");

    const written = JSON.parse(await readFile(path, "utf-8")) as Record<string, unknown>;
    expect(written).toStrictEqual({
      version: 1,
      method: "stored",
      level: "user",
      createdAt: written.createdAt,
      token: "ghp_x",
    });
  });

  it("writes a stored and an external record as these exact bytes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      await storage.save({ method: "stored", token: "ghp_x" }, "user");
      const stored = await readFile(path, "utf-8");
      await storage.save({ method: "external", provider: "gh" }, "user");
      const external = await readFile(path, "utf-8");

      expect(stored).toBe(
        [
          "{",
          '  "version": 1,',
          '  "method": "stored",',
          '  "level": "user",',
          '  "createdAt": "1970-01-01T00:00:00.000Z",',
          '  "token": "ghp_x"',
          "}",
        ].join("\n")
      );
      expect(external).toBe(
        [
          "{",
          '  "version": 1,',
          '  "method": "external",',
          '  "level": "user",',
          '  "createdAt": "1970-01-01T00:00:00.000Z",',
          '  "provider": "gh"',
          "}",
        ].join("\n")
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses to grant an empty Windows account", async () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform");
    const username = process.env.USERNAME;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    process.env.USERNAME = "";
    try {
      await expect(storage.save({ method: "stored", token: "ghp_x" }, "user")).rejects.toThrow(
        new AuthStorageError(
          "Failed to set restrictive permissions on " +
            `${path}: USERNAME is not set, so no account can be granted access`
        )
      );
    } finally {
      if (platform !== undefined) Object.defineProperty(process, "platform", platform);
      if (username === undefined) delete process.env.USERNAME;
      else process.env.USERNAME = username;
    }
  });
});
