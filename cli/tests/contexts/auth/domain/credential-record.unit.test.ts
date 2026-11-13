import { describe, expect, it } from "vitest";
import {
  LEVELS_BY_PRECEDENCE,
  parseCredentialRecord,
  providerNamed,
  providerOf,
  recordCredential,
  removalHint,
  storedTokenOf,
} from "../../../../src/contexts/auth/domain/credential-record.js";
import { AuthenticationError } from "../../../../src/shared/domain/errors.js";
import { anExternalRecord, aStoredRecord } from "../testing/credential-records.js";

describe("parsing a stored record", () => {
  it.each([
    ["null", null],
    ["a string", "ghp_x"],
    ["a number", 1],
    ["an array", []],
    ["another version", { ...aStoredRecord(), version: 2 }],
    ["an unknown method", { ...aStoredRecord(), method: "gh" }],
    ["an unknown level", { ...aStoredRecord(), level: "global" }],
    ["no createdAt", { ...aStoredRecord(), createdAt: undefined }],
  ])("reads %s as no record", (_shape, value) => {
    expect(parseCredentialRecord(value)).toBeNull();
  });

  it("reads a valid record as itself", () => {
    const record = aStoredRecord({ level: "project" });

    expect(parseCredentialRecord(record)).toStrictEqual(record);
  });
});

describe("recording a credential", () => {
  const at = new Date(0);

  it("keeps a stored credential's token and names no provider", () => {
    expect(recordCredential({ method: "stored", token: "ghp_x" }, "project", at)).toStrictEqual({
      version: 1,
      method: "stored",
      level: "project",
      createdAt: "1970-01-01T00:00:00.000Z",
      token: "ghp_x",
    });
  });

  it("keeps an external credential's provider and no token", () => {
    expect(recordCredential({ method: "external", provider: "gh" }, "user", at)).toStrictEqual({
      version: 1,
      method: "external",
      level: "user",
      createdAt: "1970-01-01T00:00:00.000Z",
      provider: "gh",
    });
  });
});

describe("removal hint, provider and stored token", () => {
  it("answers the cleanup hint for an external record only", () => {
    expect(removalHint(anExternalRecord())).toBe("external-provider-cleanup");
    expect(removalHint(aStoredRecord())).toBeUndefined();
  });

  it("answers the provider an external record names, and gh when it names none", () => {
    expect(providerOf(anExternalRecord({ provider: "glab" }))).toBe("glab");
    expect(providerOf(anExternalRecord({ provider: undefined }))).toBe("gh");
  });

  it("answers a stored record's token, and refuses one that carries none", () => {
    expect(storedTokenOf(aStoredRecord({ token: "ghp_kept" }))).toBe("ghp_kept");
    expect(() => storedTokenOf(aStoredRecord({ token: undefined }))).toThrow(
      new AuthenticationError("invalid config")
    );
    expect(() => storedTokenOf(aStoredRecord({ token: "" }))).toThrow(
      new AuthenticationError("invalid config")
    );
  });
});

describe("the provider a credential names", () => {
  it("is the registered one of that name, and one nobody registered is refused by name", () => {
    const providers = new Map([
      ["gh", "the gh provider"],
      ["glab", "the glab provider"],
    ]);

    expect(providerNamed(providers, "glab")).toBe("the glab provider");
    expect(() => providerNamed(providers, "hub")).toThrow(
      new AuthenticationError("unknown external provider: hub")
    );
  });
});

describe("the order of levels", () => {
  it("puts the project's own record before the user's", () => {
    expect(LEVELS_BY_PRECEDENCE).toStrictEqual(["project", "user"]);
  });
});
