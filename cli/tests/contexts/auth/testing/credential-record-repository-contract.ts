import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AuthLevel } from "../../../../src/contexts/auth/contract/credential.js";
import type { CredentialRecordRepository } from "../../../../src/contexts/auth/ports/credential-record-repository.js";

/** What a contract run needs from one implementation of the repository. */
export interface RepositorySubject {
  readonly repository: CredentialRecordRepository;
  dispose(): Promise<void>;
}

export type RepositoryCaseId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

/** Cases a subject is known to fail, each with the divergence it stands for; such a case runs
 * as an expected failure and goes red the day the subject is fixed. */
export type RepositoryDivergences = Partial<Record<RepositoryCaseId, string>>;

const LEVELS: readonly AuthLevel[] = ["project", "user"];

/**
 * What the repository promises, stated once and run against every implementation of it. A
 * case red on the real adapter is a wrong case; red on the fake, a lie the fake tells. The
 * unreadable file is no case here: the port has no operation that writes one.
 */
export function describeCredentialRecordRepositoryContract(
  subjectName: string,
  makeSubject: () => Promise<RepositorySubject>,
  knownDivergences: RepositoryDivergences = {}
): void {
  describe(`when the credential record repository is ${subjectName}`, () => {
    let subject: RepositorySubject;

    beforeEach(async () => {
      subject = await makeSubject();
    });

    afterEach(async () => {
      await subject.dispose();
    });

    function contractCase(id: RepositoryCaseId, name: string, body: () => Promise<void>): void {
      const run = knownDivergences[id] === undefined ? it : it.fails;
      run(name, body);
    }

    contractCase("R1", "reads no record at a level nothing was saved to", async () => {
      for (const level of LEVELS) expect(await subject.repository.read(level)).toBeNull();
    });

    for (const level of LEVELS) {
      contractCase("R2", `reads a saved credential back at the ${level} level only`, async () => {
        await subject.repository.save({ method: "stored", token: "ghp_saved" }, level);

        expect(await subject.repository.read(level)).toMatchObject({ level, token: "ghp_saved" });
        const other = level === "user" ? "project" : "user";
        expect(await subject.repository.read(other)).toBeNull();
      });
    }

    contractCase("R3", "keeps a stored credential with its token and no provider", async () => {
      await subject.repository.save({ method: "stored", token: "ghp_saved" }, "user");

      expect(await subject.repository.read("user")).toStrictEqual({
        version: 1,
        method: "stored",
        level: "user",
        createdAt: expect.any(String),
        token: "ghp_saved",
      });
    });

    contractCase("R4", "keeps an external credential with its provider and no token", async () => {
      await subject.repository.save({ method: "external", provider: "gh" }, "user");

      expect(await subject.repository.read("user")).toStrictEqual({
        version: 1,
        method: "external",
        level: "user",
        createdAt: expect.any(String),
        provider: "gh",
      });
    });

    contractCase("R5", "deletes the record of one level and leaves the other", async () => {
      await subject.repository.save({ method: "stored", token: "ghp_project" }, "project");
      await subject.repository.save({ method: "stored", token: "ghp_user" }, "user");

      await subject.repository.delete("project");

      expect(await subject.repository.read("project")).toBeNull();
      expect(await subject.repository.read("user")).toMatchObject({ token: "ghp_user" });
    });

    contractCase("R6", "deletes a level that holds nothing without complaint", async () => {
      await expect(subject.repository.delete("user")).resolves.toBeUndefined();
    });
  });
}
