import { describe, expect, it } from "vitest";
import { TokenResolver } from "../../../src/infrastructure/auth/token-resolver.js";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const original: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    original[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      process.env[key] = value;
    }
  }
}

describe("TokenResolver", () => {
  const resolver = new TokenResolver();

  describe("flag resolution", () => {
    it("uses flag token when flag is provided", () => {
      const token = withEnv({ AIDD_TOKEN: "env-token" }, () =>
        resolver.resolve({ flag: "flag-token" })
      );
      expect(token).toBe("flag-token");
    });
  });

  describe("env var resolution", () => {
    it("uses env var token when no flag is provided", () => {
      const token = withEnv({ AIDD_TOKEN: "env-secret" }, () => resolver.resolve());
      expect(token).toBe("env-secret");
    });
  });

  describe("gh auth token fallback", () => {
    it("falls back gracefully when gh CLI is unavailable", () => {
      const original = process.env.AIDD_TOKEN;
      process.env.AIDD_TOKEN = undefined;
      try {
        expect(() => resolver.resolve()).not.toThrow();
      } finally {
        process.env.AIDD_TOKEN = original;
      }
    });
  });

  describe("verbose logging", () => {
    it("logs flag method without revealing token value", () => {
      const logged: string[] = [];
      const logger = {
        debug: (msg: string) => logged.push(msg),
        info: (_msg: string) => {},
        warn: (_msg: string) => {},
      };

      resolver.resolve({ flag: "secret-value", logger });
      expect(logged).toContain("Token resolved from --token flag");
      expect(logged.every((m) => !m.includes("secret-value"))).toBe(true);
    });

    it("logs env method when using AIDD_TOKEN", () => {
      const logged: string[] = [];
      const logger = {
        debug: (msg: string) => logged.push(msg),
        info: (_msg: string) => {},
        warn: (_msg: string) => {},
      };

      withEnv({ AIDD_TOKEN: "env-secret" }, () => resolver.resolve({ logger }));
      expect(logged).toContain("Token resolved from AIDD_TOKEN env");
      expect(logged.every((m) => !m.includes("env-secret"))).toBe(true);
    });
  });
});
