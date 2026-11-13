import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../../../../src/shared/domain/errors.js";
import { aLogIn } from "../testing/auth-builders.js";
import { FakeCliAuthProvider } from "../testing/fake-cli-auth-provider.js";
import { FakeIdentityVerifier } from "../testing/fake-identity-verifier.js";
import { InMemoryCredentialRecordRepository } from "../testing/in-memory-credential-record-repository.js";

describe("LogIn", () => {
  describe("when a stored token is handed", () => {
    it("verifies that token and reports its login at the level asked", async () => {
      const identity = new FakeIdentityVerifier({ ghp_secret: "octocat" });

      const result = await aLogIn()
        .withIdentity(identity)
        .build()
        .execute({ credential: { method: "stored", token: "ghp_secret" }, level: "project" });

      expect(identity.seen).toEqual(["ghp_secret"]);
      expect(result).toStrictEqual({ login: "octocat", level: "project" });
    });

    it("saves it at the level asked", async () => {
      const records = new InMemoryCredentialRecordRepository();

      await aLogIn()
        .withRecords(records)
        .withIdentity(new FakeIdentityVerifier({ ghp_secret: "octocat" }))
        .build()
        .execute({ credential: { method: "stored", token: "ghp_secret" }, level: "user" });

      expect(await records.read("user")).toMatchObject({ method: "stored", token: "ghp_secret" });
      expect(await records.read("project")).toBeNull();
    });
  });

  describe("when the token check refuses", () => {
    it("throws and saves nothing", async () => {
      const records = new InMemoryCredentialRecordRepository();

      await expect(
        aLogIn()
          .withRecords(records)
          .build()
          .execute({ credential: { method: "stored", token: "ghp_refused" }, level: "user" })
      ).rejects.toThrow(new AuthenticationError("GitHub API"));

      expect(await records.read("user"), "a refused token is never recorded").toBeNull();
    });
  });

  describe("when an external provider is named", () => {
    it("asks that provider and reports its login", async () => {
      const records = new InMemoryCredentialRecordRepository();

      const result = await aLogIn()
        .withRecords(records)
        .withCliProvider("gh", new FakeCliAuthProvider({ login: "from-gh" }))
        .withCliProvider("glab", new FakeCliAuthProvider({ login: "from-glab" }))
        .build()
        .execute({ credential: { method: "external", provider: "glab" }, level: "user" });

      expect(result).toStrictEqual({ login: "from-glab", level: "user" });
      expect(await records.read("user")).toMatchObject({ method: "external", provider: "glab" });
    });
  });

  describe("when the named provider is not registered", () => {
    it("throws an error naming it, so the spelling can be fixed", async () => {
      await expect(
        aLogIn()
          .withCliProvider("gh", new FakeCliAuthProvider({ login: "from-gh" }))
          .build()
          .execute({ credential: { method: "external", provider: "hub" }, level: "user" })
      ).rejects.toThrow(new AuthenticationError("unknown external provider: hub"));
    });
  });

  describe("when the named provider refuses", () => {
    it("throws and saves nothing", async () => {
      const records = new InMemoryCredentialRecordRepository();

      await expect(
        aLogIn()
          .withRecords(records)
          .withCliProvider("gh", new FakeCliAuthProvider())
          .build()
          .execute({ credential: { method: "external", provider: "gh" }, level: "project" })
      ).rejects.toThrow(new AuthenticationError("gh CLI"));

      expect(await records.read("project")).toBeNull();
    });
  });
});
