import { expect, it } from "vitest";
import type { RepositoryLocator } from "../../../../src/contexts/telemetry/ports/repository-locator.js";
import { type ContractSubject, describeSubject } from "./contract-subject.js";

export interface RepositoryOptions {
  /** The url `origin` points at; none when absent. */
  readonly remote?: string;
  /** Whether the history holds a first commit. */
  readonly commit: boolean;
}

export interface RepositoryLocatorSubject extends ContractSubject {
  readonly locator: RepositoryLocator;
  /** A directory nothing was ever made at. */
  missingDirectory(): string;
  /** A directory that exists and belongs to no repository. */
  plainDirectory(): Promise<string>;
  /** The working tree of a new repository. */
  repository(options: RepositoryOptions): Promise<string>;
  /** A linked worktree of the repository whose working tree is `main`. */
  linkedWorktree(main: string): Promise<string>;
}

/** What the repository locator promises, stated once and run against every implementation. */
export function describeRepositoryLocatorContract(
  subjectName: string,
  makeSubject: () => Promise<RepositoryLocatorSubject>
): void {
  describeSubject(`when the repository locator is ${subjectName}`, makeSubject, (subject) => {
    it("finds a directory that is gone", async () => {
      expect(await subject().locator.locate(subject().missingDirectory())).toEqual({
        status: "gone",
      });
    });

    it("finds a directory outside any repository", async () => {
      const plain = await subject().plainDirectory();

      expect(await subject().locator.locate(plain)).toEqual({ status: "outside-repository" });
    });

    it("finds a repository's working tree as its own root and main root", async () => {
      const root = await subject().repository({ commit: true });

      expect(await subject().locator.locate(root)).toMatchObject({
        status: "repository",
        root,
        mainRoot: root,
      });
    });

    it("reads the url origin points at", async () => {
      const root = await subject().repository({
        remote: "git@github.com:acme/widgets.git",
        commit: true,
      });

      expect(await subject().locator.locate(root)).toMatchObject({
        remote: "git@github.com:acme/widgets.git",
      });
    });

    it("reads no remote from a repository with no origin", async () => {
      const root = await subject().repository({ commit: true });

      expect(await subject().locator.locate(root)).toMatchObject({ remote: null });
    });

    it("finds a linked worktree as its own root, apart from the main working tree", async () => {
      const main = await subject().repository({ commit: true });
      const linked = await subject().linkedWorktree(main);

      expect(await subject().locator.locate(linked)).toMatchObject({
        status: "repository",
        root: linked,
        mainRoot: main,
      });
    });

    it("reads a root commit once the history has one", async () => {
      const root = await subject().repository({ commit: true });

      expect(await subject().locator.locate(root)).toMatchObject({
        rootCommit: expect.any(String),
      });
    });

    it("reads no root commit before the first commit", async () => {
      const root = await subject().repository({ commit: false });

      expect(await subject().locator.locate(root)).toMatchObject({ rootCommit: null });
    });
  });
}
