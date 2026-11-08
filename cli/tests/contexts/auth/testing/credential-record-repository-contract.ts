import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AuthLevel } from "../../../../src/contexts/auth/contract/credential.js";
import type { CredentialRecordRepository } from "../../../../src/contexts/auth/ports/credential-record-repository.js";

/** What a contract run needs from one implementation of the repository. */
export interface RepositorySubject {
  readonly repository: CredentialRecordRepository;
  dispose(): Promise<void>;
}

const LEVELS: readonly AuthLevel[] = ["project", "user"];

/**
 * What the repository promises, stated once and run against every implementation of it. A
 * case red on the real adapter is a wrong case; red on the fake, a lie the fake tells. The
 * unreadable file is no case here: the port has no operation that writes one.
 */
export function describeCredentialRecordRepositoryContract(
  subjectName: string,
  makeSubject: () => Promise<RepositorySubject>
): void {
  describe(`when the credential record repository is ${subjectName}`, () => {
    let subject: RepositorySubject;

    beforeEach(async () => {
      subject = await makeSubject();
    });

    afterEach(async () => {
      await subject.dispose();
    });

    it("reads no record at a level nothing was saved to", async () => {
      for (const level of LEVELS) expect(await subject.repository.read(level)).toBeNull();
    });

    for (const level of LEVELS) {
      it(`reads a saved credential back at the ${level} level only`, async () => {
        await subject.repository.save({ method: "stored", token: "ghp_saved" }, level);

        expect(await subject.repository.read(level)).toMatchObject({ level, token: "ghp_saved" });
        const other = level === "user" ? "project" : "user";
        expect(await subject.repository.read(other)).toBeNull();
      });
    }

    it("keeps a stored credential with its token and no provider", async () => {
      await subject.repository.save({ method: "stored", token: "ghp_saved" }, "user");

      expect(await subject.repository.read("user")).toStrictEqual({
        version: 1,
        method: "stored",
        level: "user",
        createdAt: expect.any(String),
        token: "ghp_saved",
      });
    });

    it("keeps an external credential with its provider and no token", async () => {
      await subject.repository.save({ method: "external", provider: "gh" }, "user");

      expect(await subject.repository.read("user")).toStrictEqual({
        version: 1,
        method: "external",
        level: "user",
        createdAt: expect.any(String),
        provider: "gh",
      });
    });

    it("deletes the record of one level and leaves the other", async () => {
      await subject.repository.save({ method: "stored", token: "ghp_project" }, "project");
      await subject.repository.save({ method: "stored", token: "ghp_user" }, "user");

      await subject.repository.delete("project");

      expect(await subject.repository.read("project")).toBeNull();
      expect(await subject.repository.read("user")).toMatchObject({ token: "ghp_user" });
    });

    it("deletes a level that holds nothing without complaint", async () => {
      await expect(subject.repository.delete("user")).resolves.toBeUndefined();
    });
  });
}
