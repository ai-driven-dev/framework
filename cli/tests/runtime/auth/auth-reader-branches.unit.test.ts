import { describe, expect, it } from "vitest";
import type { AuthConfig } from "../../../src/runtime/auth/auth.js";
import { AuthReaderAdapter } from "../../../src/runtime/auth/auth-reader-adapter.js";
import type { AuthStorage } from "../../../src/runtime/auth/auth-storage.js";
import { CapturingLogger } from "../../helpers/ports/capturing-logger.js";

const PROJECT = "/project/.aidd/auth.json";
const USER = "/home/user/.config/aidd/auth.json";

function storage(project: AuthConfig | null, user: AuthConfig | null): AuthStorage {
  return {
    userConfigPath: () => USER,
    projectConfigPath: () => PROJECT,
    read: async (path: string) => (path === PROJECT ? project : path === USER ? user : null),
    write: async () => {},
    delete: async () => {},
    save: async () => {},
    readActive: async () => null,
  } as AuthStorage;
}

function stored(token: string | undefined): AuthConfig {
  return { version: 1, method: "stored", level: "project", token, createdAt: "2026-01-01" };
}

function external(token?: string): AuthConfig {
  return { version: 1, method: "external", level: "project", token, createdAt: "2026-01-01" };
}

function withoutEnvToken<T>(run: () => Promise<T>): Promise<T> {
  const saved = process.env.AIDD_TOKEN;
  delete process.env.AIDD_TOKEN;
  return run().finally(() => {
    if (saved !== undefined) process.env.AIDD_TOKEN = saved;
  });
}

describe("AuthReaderAdapter, which record answers", () => {
  it("says where the token came from, and never the token", async () => {
    const logger = new CapturingLogger();
    const reader = new AuthReaderAdapter(storage(stored("ghp_p"), null), "/project", logger);

    await withoutEnvToken(() => reader.resolve());

    expect(logger.debugMessages).toStrictEqual(["Token resolved from project auth.json (stored)"]);
  });

  it("names the user record when that one answered", async () => {
    const logger = new CapturingLogger();
    const reader = new AuthReaderAdapter(storage(null, stored("ghp_u")), "/project", logger);

    await withoutEnvToken(() => reader.resolve());

    expect(logger.debugMessages).toStrictEqual(["Token resolved from user auth.json (stored)"]);
  });

  it("names the external provider when it answered", async () => {
    const logger = new CapturingLogger();
    const reader = new AuthReaderAdapter(storage(external(), null), "/project", logger, {
      resolve: () => "gh_tok",
    });

    expect(await withoutEnvToken(() => reader.resolve())).toBe("gh_tok");
    expect(logger.debugMessages).toStrictEqual([
      "Token resolved from project auth.json (external)",
    ]);
  });

  it("says so when nothing answered", async () => {
    const logger = new CapturingLogger();
    const reader = new AuthReaderAdapter(storage(null, null), "/project", logger);

    expect(await withoutEnvToken(() => reader.resolve())).toBeNull();
    expect(logger.debugMessages).toStrictEqual(["No token available"]);
  });

  it("names the command line when the token came from it", async () => {
    const logger = new CapturingLogger();
    const reader = new AuthReaderAdapter(storage(null, null), "/project", logger, undefined, "cli");

    expect(await reader.resolve()).toBe("cli");
    expect(logger.debugMessages).toStrictEqual(["Token given on the command line"]);
  });

  it("falls past a stored record carrying no token", async () => {
    const reader = new AuthReaderAdapter(storage(stored(undefined), stored("ghp_u")), "/project");

    expect(await withoutEnvToken(() => reader.resolve())).toBe("ghp_u");
  });

  it("never asks the external provider for a stored record", async () => {
    const reader = new AuthReaderAdapter(storage(stored(undefined), null), "/project", undefined, {
      resolve: () => "gh_tok",
    });

    expect(await withoutEnvToken(() => reader.resolve())).toBeNull();
  });

  it("asks the provider for an external record even when a stray token sits in it", async () => {
    const reader = new AuthReaderAdapter(storage(external("stale"), null), "/project", undefined, {
      resolve: () => "gh_tok",
    });

    expect(await withoutEnvToken(() => reader.resolve())).toBe("gh_tok");
  });

  it("falls past an external record when the provider has nothing", async () => {
    const logger = new CapturingLogger();
    const reader = new AuthReaderAdapter(storage(external(), stored("ghp_u")), "/project", logger, {
      resolve: () => null,
    });

    expect(await withoutEnvToken(() => reader.resolve())).toBe("ghp_u");
    expect(logger.debugMessages).toStrictEqual(["Token resolved from user auth.json (stored)"]);
  });

  it("answers nothing for an external record when no provider was wired", async () => {
    const reader = new AuthReaderAdapter(storage(external(), null), "/project");

    expect(await withoutEnvToken(() => reader.resolve())).toBeNull();
  });
});
