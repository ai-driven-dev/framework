import { describe, expect, it } from "vitest";
import type { AuthConfig } from "../../../src/domain/models/auth-config.js";
import type { ExternalTokenProvider } from "../../../src/domain/ports/external-token-provider.js";
import { AuthReader } from "../../../src/infrastructure/auth/auth-reader.js";
import type { AuthStorage } from "../../../src/infrastructure/auth/auth-storage.js";

function makeStorage(
  overrides: Partial<{
    projectConfig: AuthConfig | null;
    userConfig: AuthConfig | null;
  }> = {}
): AuthStorage {
  const projectConfig = overrides.projectConfig ?? null;
  const userConfig = overrides.userConfig ?? null;
  return {
    userConfigPath: () => "/home/user/.config/aidd/auth.json",
    projectConfigPath: (_root: string) => "/project/.aidd/auth.json",
    read: async (path: string) => {
      if (path === "/project/.aidd/auth.json") return projectConfig;
      if (path === "/home/user/.config/aidd/auth.json") return userConfig;
      return null;
    },
    write: async () => {},
    delete: async () => {},
  } as AuthStorage;
}

function makeExternalProvider(token: string | null): ExternalTokenProvider {
  return { resolve: () => token };
}

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const original: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    original[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("AuthReader", () => {
  describe("AIDD_TOKEN env var (path 1)", () => {
    it("returns env token immediately", async () => {
      const storage = makeStorage();
      const reader = new AuthReader(storage, "/project");
      const result = await withEnv({ AIDD_TOKEN: "env-token" }, () => reader.resolve());
      expect(result).toBe("env-token");
    });
  });

  describe("project auth.json (path 2)", () => {
    it("returns stored token when method=token", async () => {
      const config: AuthConfig = {
        version: 1,
        method: "token",
        level: "project",
        token: "project-token",
        createdAt: "2026-03-20T00:00:00.000Z",
      };
      const storage = makeStorage({ projectConfig: config });
      const reader = new AuthReader(storage, "/project");
      const result = await withEnv({ AIDD_TOKEN: undefined }, () => reader.resolve());
      expect(result).toBe("project-token");
    });

    it("returns external token when method=gh", async () => {
      const config: AuthConfig = {
        version: 1,
        method: "gh",
        level: "project",
        createdAt: "2026-03-20T00:00:00.000Z",
      };
      const storage = makeStorage({ projectConfig: config });
      const reader = new AuthReader(
        storage,
        "/project",
        undefined,
        makeExternalProvider("gh-project-token")
      );
      const result = await withEnv({ AIDD_TOKEN: undefined }, () => reader.resolve());
      expect(result).toBe("gh-project-token");
    });
  });

  describe("user auth.json (path 3)", () => {
    it("returns stored token when method=token and no project config", async () => {
      const config: AuthConfig = {
        version: 1,
        method: "token",
        level: "user",
        token: "user-token",
        createdAt: "2026-03-20T00:00:00.000Z",
      };
      const storage = makeStorage({ userConfig: config });
      const reader = new AuthReader(storage, "/project");
      const result = await withEnv({ AIDD_TOKEN: undefined }, () => reader.resolve());
      expect(result).toBe("user-token");
    });

    it("returns external token when method=gh", async () => {
      const config: AuthConfig = {
        version: 1,
        method: "gh",
        level: "user",
        createdAt: "2026-03-20T00:00:00.000Z",
      };
      const storage = makeStorage({ userConfig: config });
      const reader = new AuthReader(
        storage,
        "/project",
        undefined,
        makeExternalProvider("gh-user-token")
      );
      const result = await withEnv({ AIDD_TOKEN: undefined }, () => reader.resolve());
      expect(result).toBe("gh-user-token");
    });
  });

  describe("null fallback (path 4)", () => {
    it("returns null when no token source is available", async () => {
      const storage = makeStorage();
      const reader = new AuthReader(storage, "/project", undefined, makeExternalProvider(null));
      const result = await withEnv({ AIDD_TOKEN: undefined }, () => reader.resolve());
      expect(result).toBeNull();
    });
  });

  describe("logging", () => {
    it("logs resolution source without revealing token value", async () => {
      const logged: string[] = [];
      const logger = {
        debug: (msg: string) => logged.push(msg),
        info: (_msg: string) => {},
        warn: (_msg: string) => {},
      };
      const storage = makeStorage();
      const reader = new AuthReader(storage, "/project", logger);
      await withEnv({ AIDD_TOKEN: "my-secret" }, () => reader.resolve());
      expect(logged.some((m) => m.includes("AIDD_TOKEN"))).toBe(true);
      expect(logged.every((m) => !m.includes("my-secret"))).toBe(true);
    });
  });
});
