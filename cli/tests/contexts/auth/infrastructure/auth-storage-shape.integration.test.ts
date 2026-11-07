import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthStorage } from "../../../../src/contexts/auth/infrastructure/auth-storage.js";
import { AuthStorageError } from "../../../../src/kernel/errors.js";
import { makeAuthConfig } from "../../../helpers/auth.js";

describe("AuthStorage, the shape of a record", () => {
  let tempDir: string;
  let path: string;
  let storage: AuthStorage;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-auth-shape-"));
    path = join(tempDir, "auth.json");
    storage = new AuthStorage(() => tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it.each([
    ["null", "null"],
    ["a string", '"ghp_x"'],
    ["a number", "1"],
    ["an array", "[]"],
    ["another version", JSON.stringify({ ...makeAuthConfig(), version: 2 })],
    ["an unknown method", JSON.stringify({ ...makeAuthConfig(), method: "gh" })],
    ["an unknown level", JSON.stringify({ ...makeAuthConfig(), level: "global" })],
    ["no createdAt", JSON.stringify({ ...makeAuthConfig(), createdAt: undefined })],
  ])("reads %s as no record at all", async (_shape, content) => {
    await writeFile(path, content);

    expect(await storage.read(path)).toBeNull();
  });

  it("reads back exactly what it wrote, pretty-printed", async () => {
    const config = makeAuthConfig();

    await storage.write(path, config);

    expect(await readFile(path, "utf-8")).toBe(JSON.stringify(config, null, 2));
  });

  it("records an external credential with its provider and no token", async () => {
    await storage.save({
      credential: { method: "external", provider: "gh" },
      level: "user",
      projectRoot: tempDir,
    });

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
    await storage.save({
      credential: { method: "stored", token: "ghp_x" },
      level: "user",
      projectRoot: tempDir,
    });

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
      await storage.save({
        credential: { method: "stored", token: "ghp_x" },
        level: "user",
        projectRoot: tempDir,
      });
      const stored = await readFile(path, "utf-8");
      await storage.save({
        credential: { method: "external", provider: "gh" },
        level: "user",
        projectRoot: tempDir,
      });
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

  it("synthesises a stored user-level record from AIDD_TOKEN", async () => {
    const saved = process.env.AIDD_TOKEN;
    process.env.AIDD_TOKEN = "ghp_env";
    try {
      const active = await storage.readActive(tempDir);
      expect(active).toStrictEqual({
        version: 1,
        method: "stored",
        level: "user",
        token: "ghp_env",
        createdAt: active?.createdAt,
      });
    } finally {
      if (saved === undefined) delete process.env.AIDD_TOKEN;
      else process.env.AIDD_TOKEN = saved;
    }
  });

  it("refuses to grant an empty Windows account", async () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform");
    const username = process.env.USERNAME;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    process.env.USERNAME = "";
    try {
      await expect(storage.write(path, makeAuthConfig())).rejects.toThrow(
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
