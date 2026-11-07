import { describe, expect, it } from "vitest";
import { aLogOut } from "../testing/auth-builders.js";
import { anExternalRecord, aStoredRecord } from "../testing/credential-records.js";
import { InMemoryCredentialRecordRepository } from "../testing/in-memory-credential-record-repository.js";

describe("LogOut", () => {
  describe("when nothing is stored", () => {
    it("reports nothing found", async () => {
      expect(await aLogOut().build().execute()).toStrictEqual({ found: false });
    });
  });

  describe("when a project record is stored", () => {
    it("deletes it and reports the project level, with no hint", async () => {
      const records = new InMemoryCredentialRecordRepository().seed(
        "project",
        aStoredRecord({ level: "project" })
      );

      const result = await aLogOut().withRecords(records).build().execute();

      expect(result).toStrictEqual({ found: true, level: "project", hint: undefined });
      expect(await records.read("project")).toBeNull();
    });
  });

  describe("when only a user record is stored", () => {
    it("deletes it and reports the user level", async () => {
      const records = new InMemoryCredentialRecordRepository().seed("user", aStoredRecord());

      const result = await aLogOut().withRecords(records).build().execute();

      expect(result).toMatchObject({ found: true, level: "user" });
      expect(await records.read("user")).toBeNull();
    });
  });

  describe("when the record names an external provider", () => {
    it("reports the external-provider-cleanup hint", async () => {
      const records = new InMemoryCredentialRecordRepository().seed("user", anExternalRecord());

      expect(await aLogOut().withRecords(records).build().execute()).toMatchObject({
        hint: "external-provider-cleanup",
      });
    });
  });

  describe("when both levels hold a record", () => {
    it("deletes the project one and keeps the user one", async () => {
      const records = new InMemoryCredentialRecordRepository()
        .seed("project", aStoredRecord({ level: "project" }))
        .seed("user", aStoredRecord({ token: "ghp_user" }));

      const result = await aLogOut().withRecords(records).build().execute();

      expect(result).toMatchObject({ found: true, level: "project" });
      expect(await records.read("project")).toBeNull();
      expect(await records.read("user")).not.toBeNull();
    });
  });

  describe("when the record names a level other than its file's", () => {
    it("reports the level the record names", async () => {
      const records = new InMemoryCredentialRecordRepository().seed(
        "project",
        aStoredRecord({ level: "user" })
      );

      expect(await aLogOut().withRecords(records).build().execute()).toMatchObject({
        level: "user",
      });
      expect(await records.read("project")).toBeNull();
    });
  });
});
