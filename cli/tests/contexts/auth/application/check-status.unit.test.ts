import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../../../../src/shared/domain/errors.js";
import { aCheckStatus } from "../testing/auth-builders.js";
import { anExternalRecord, aStoredRecord } from "../testing/credential-records.js";
import { FakeCliAuthProvider } from "../testing/fake-cli-auth-provider.js";
import { FakeIdentityVerifier } from "../testing/fake-identity-verifier.js";
import { InMemoryCredentialRecordRepository } from "../testing/in-memory-credential-record-repository.js";

describe("CheckStatus", () => {
  describe("when nothing is stored", () => {
    it("reports not authenticated and verifies nothing", async () => {
      const identity = new FakeIdentityVerifier();

      expect(await aCheckStatus().withIdentity(identity).build().execute()).toStrictEqual({
        authenticated: false,
      });
      expect(identity.seen, "no credential means no verification call").toEqual([]);
    });
  });

  describe("when a stored record is active", () => {
    it("verifies its token and reports the login at the record's level", async () => {
      const identity = new FakeIdentityVerifier({ ghp_stored: "octocat" });
      const records = new InMemoryCredentialRecordRepository().seed(
        "project",
        aStoredRecord({ level: "project", token: "ghp_stored" })
      );

      const result = await aCheckStatus()
        .withRecords(records)
        .withIdentity(identity)
        .build()
        .execute();

      expect(result).toStrictEqual({ authenticated: true, login: "octocat", level: "project" });
      expect(identity.seen).toEqual(["ghp_stored"]);
    });

    it("reports the level the record names, not the file it was read from", async () => {
      const records = new InMemoryCredentialRecordRepository().seed(
        "project",
        aStoredRecord({ level: "user", token: "ghp_stored" })
      );

      const result = await aCheckStatus()
        .withRecords(records)
        .withIdentity(new FakeIdentityVerifier({ ghp_stored: "octocat" }))
        .build()
        .execute();

      expect(result).toMatchObject({ level: "user" });
    });
  });

  describe("when the active stored record carries no token", () => {
    it("throws invalid config", async () => {
      const records = new InMemoryCredentialRecordRepository().seed(
        "user",
        aStoredRecord({ token: undefined })
      );

      await expect(aCheckStatus().withRecords(records).build().execute()).rejects.toThrow(
        new AuthenticationError("invalid config")
      );
    });
  });

  describe("when an external record is active", () => {
    it.each([
      ["the provider it names", "glab", "from-glab"],
      [
        "gh when the record names no provider, as one written before providers were named",
        undefined,
        "from-gh",
      ],
    ])("asks %s", async (_who, provider, login) => {
      const records = new InMemoryCredentialRecordRepository().seed(
        "user",
        anExternalRecord({ provider })
      );

      const result = await aCheckStatus()
        .withRecords(records)
        .withCliProvider("gh", new FakeCliAuthProvider({ login: "from-gh" }))
        .withCliProvider("glab", new FakeCliAuthProvider({ login: "from-glab" }))
        .build()
        .execute();

      expect(result).toStrictEqual({ authenticated: true, login, level: "user" });
    });

    it("names a provider nobody registered", async () => {
      const records = new InMemoryCredentialRecordRepository().seed(
        "user",
        anExternalRecord({ provider: "hub" })
      );

      await expect(aCheckStatus().withRecords(records).build().execute()).rejects.toThrow(
        new AuthenticationError("unknown external provider: hub")
      );
    });
  });

  describe("when AIDD_TOKEN is set", () => {
    it("verifies it as a stored user credential, whatever is on disk", async () => {
      const identity = new FakeIdentityVerifier({ ghp_env: "from-env" });
      const records = new InMemoryCredentialRecordRepository().seed(
        "project",
        anExternalRecord({ level: "project" })
      );

      const result = await aCheckStatus()
        .withRecords(records)
        .withEnvironmentToken("ghp_env")
        .withIdentity(identity)
        .build()
        .execute();

      expect(result).toStrictEqual({ authenticated: true, login: "from-env", level: "user" });
      expect(records.reads, "nothing on disk is read").toEqual([]);
    });
  });
});
