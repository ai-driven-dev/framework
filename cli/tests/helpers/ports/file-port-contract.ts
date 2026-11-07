import { join, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FileReader } from "../../../src/kernel/ports/file-reader.js";
import type { FileWriter } from "../../../src/kernel/ports/file-writer.js";
import type { Hasher } from "../../../src/kernel/ports/hasher.js";

/** What a contract run needs from one implementation of the file port. */
export interface FileSubject {
  readonly files: FileReader & FileWriter;
  /** A directory this run owns, already resolved: every path a case builds hangs from it. */
  readonly root: string;
  readonly hasher: Hasher;
  /** Makes `path` a symlink to the directory `target`. */
  link(target: string, path: string): Promise<void>;
  dispose(): Promise<void>;
}

export type ContractCaseId =
  | "C1"
  | "C2"
  | "C3"
  | "C4"
  | "C5"
  | "C6"
  | "C7"
  | "C8"
  | "C9"
  | "C10"
  | "C11"
  | "C12"
  | "C13"
  | "C14"
  | "C15"
  | "C17"
  | "C18"
  | "C19"
  | "C20"
  | "C21";

/**
 * Cases a subject is known to fail, keyed by case, each with the divergence it stands for.
 * Such a case runs as an expected failure: it goes red the day the subject is fixed, and the
 * entry is then deleted. A subject that is the reference passes none.
 */
export type KnownDivergences = Partial<Record<ContractCaseId, string>>;

const WRITTEN_CONTENTS: readonly [string, string][] = [
  ["LF line endings", "one\ntwo\n"],
  ["CRLF line endings", "one\r\ntwo\r\n"],
  ["multibyte UTF-8", "café ☃ \u{1f600}"],
  ["a leading byte order mark", "﻿content"],
];

/**
 * What the file port promises, stated once and run against every implementation of it.
 * Paths are compared as sets and errors by `code` alone: listing order is unspecified, and
 * product code reads nothing else of an error. A case that fails on the real adapter is a wrong
 * case; one that fails on the double is a lie the double tells.
 */
export function describeFileContract(
  subjectName: string,
  makeSubject: () => Promise<FileSubject>,
  knownDivergences: KnownDivergences = {}
): void {
  describe(`when the file port is ${subjectName}`, () => {
    let subject: FileSubject;

    beforeEach(async () => {
      subject = await makeSubject();
    });

    afterEach(async () => {
      await subject.dispose();
    });

    const path = (...segments: string[]): string => join(subject.root, ...segments);
    const sorted = (values: readonly string[]): string[] => [...values].sort();

    function contractCase(id: ContractCaseId, name: string, body: () => Promise<void>): void {
      const run = knownDivergences[id] === undefined ? it : it.fails;
      run(name, body);
    }

    for (const [label, content] of WRITTEN_CONTENTS) {
      contractCase("C1", `reads back exactly what was written, for ${label}`, async () => {
        await subject.files.writeFile(path("f.txt"), content);

        expect(await subject.files.readFile(path("f.txt"))).toBe(content);
      });
    }

    contractCase("C2", "creates every missing parent when writing", async () => {
      await subject.files.writeFile(path("a", "b", "c.txt"), "deep");

      expect(await subject.files.readFile(path("a", "b", "c.txt"))).toBe("deep");
    });

    contractCase("C3", "replaces all of a file when writing over it", async () => {
      await subject.files.writeFile(path("f.txt"), "a much longer first content");
      await subject.files.writeFile(path("f.txt"), "short");

      expect(await subject.files.readFile(path("f.txt"))).toBe("short");
    });

    contractCase("C4", "leaves only the written file in its directory", async () => {
      await subject.files.writeFile(path("d", "f.txt"), "x");

      expect(await subject.files.listDirectory(path("d"))).toStrictEqual(["f.txt"]);
    });

    contractCase("C5", "rejects reading a missing file with code ENOENT", async () => {
      await expect(subject.files.readFile(path("missing.txt"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    });

    contractCase("C6", "hashes a file as the hasher hashes its content", async () => {
      await subject.files.writeFile(path("f.txt"), "hashable content");

      const hash = await subject.files.readFileHash(path("f.txt"));

      expect(hash.equals(subject.hasher.hash("hashable content"))).toBe(true);
    });

    contractCase(
      "C7",
      "finds a written file and a directory holding one, and not a missing path",
      async () => {
        await subject.files.writeFile(path("d", "f.txt"), "x");

        expect(await subject.files.fileExists(path("d", "f.txt"))).toBe(true);
        expect(await subject.files.fileExists(path("d"))).toBe(true);
        expect(await subject.files.fileExists(path("d", "missing.txt"))).toBe(false);
      }
    );

    contractCase("C8", "finds a created directory while it is still empty", async () => {
      await subject.files.createDirectory(path("empty", "nested"));

      expect(await subject.files.fileExists(path("empty", "nested"))).toBe(true);
    });

    contractCase("C9", "removes a deleted file and resolves for a missing one", async () => {
      await subject.files.writeFile(path("f.txt"), "x");

      await subject.files.deleteFile(path("f.txt"));
      await subject.files.deleteFile(path("never-there.txt"));

      expect(await subject.files.fileExists(path("f.txt"))).toBe(false);
    });

    contractCase(
      "C10",
      "removes a deleted directory with its tree and resolves for a missing one",
      async () => {
        await subject.files.writeFile(path("d", "a.txt"), "x");
        await subject.files.writeFile(path("d", "sub", "b.txt"), "y");

        await subject.files.deleteDirectory(path("d"));
        await subject.files.deleteDirectory(path("never-there"));

        expect(await subject.files.fileExists(path("d"))).toBe(false);
        expect(await subject.files.fileExists(path("d", "sub", "b.txt"))).toBe(false);
      }
    );

    contractCase(
      "C11",
      "removes empty directories up to the first non-empty parent, and resolves for a missing start",
      async () => {
        await subject.files.writeFile(path("a", "keep.txt"), "x");
        await subject.files.createDirectory(path("a", "b", "c"));
        expect(await subject.files.fileExists(path("a", "b", "c"))).toBe(true);

        await subject.files.deleteEmptyDirectories(path("a", "b", "c"));
        await subject.files.deleteEmptyDirectories(path("never-there"));

        expect(await subject.files.fileExists(path("a", "b", "c"))).toBe(false);
        expect(await subject.files.fileExists(path("a", "b"))).toBe(false);
        expect(await subject.files.fileExists(path("a", "keep.txt"))).toBe(true);
      }
    );

    contractCase(
      "C12",
      "lists every file below a directory, relative and slash-separated",
      async () => {
        await subject.files.writeFile(path("d", "one.txt"), "1");
        await subject.files.writeFile(path("d", "sub", "two.txt"), "2");

        expect(sorted(await subject.files.listDirectory(path("d")))).toStrictEqual([
          "one.txt",
          "sub/two.txt",
        ]);
      }
    );

    contractCase("C13", "rejects listing a missing directory with code ENOENT", async () => {
      await expect(subject.files.listDirectory(path("missing"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    });

    contractCase(
      "C14",
      "lists recursively by absolute path, and answers nothing for a missing directory",
      async () => {
        await subject.files.writeFile(path("d", "one.txt"), "1");
        await subject.files.writeFile(path("d", "sub", "two.txt"), "2");

        expect(sorted(await subject.files.listFilesRecursive(path("d")))).toStrictEqual(
          sorted([path("d", "one.txt"), path("d", "sub", "two.txt")])
        );
        expect(await subject.files.listFilesRecursive(path("missing"))).toStrictEqual([]);
      }
    );

    contractCase("C15", "skips a symlinked directory in both listings", async () => {
      await subject.files.writeFile(path("target", "inside.txt"), "x");
      await subject.files.writeFile(path("d", "plain.txt"), "y");
      await subject.link(path("target"), path("d", "link"));

      expect(await subject.files.listDirectory(path("d"))).toStrictEqual(["plain.txt"]);
      expect(await subject.files.listFilesRecursive(path("d"))).toStrictEqual([
        path("d", "plain.txt"),
      ]);
    });

    contractCase("C17", "resolves a path through a symlinked directory to its target", async () => {
      await subject.files.writeFile(path("target", "x"), "x");
      await subject.link(path("target"), path("link"));

      expect(await subject.files.realpath(path("link", "x"))).toBe(
        await subject.files.realpath(path("target", "x"))
      );
    });

    contractCase("C18", "resolves a parent segment as the directory it names", async () => {
      await subject.files.createDirectory(path("a"));
      await subject.files.writeFile(path("b", "f.txt"), "x");
      // `join` would fold the `..` away before the port saw it.
      const withParentSegment = `${path("a")}${sep}..${sep}b`;

      expect(await subject.files.realpath(withParentSegment)).toBe(
        await subject.files.realpath(path("b"))
      );
    });

    contractCase("C19", "rejects the real path of a missing path with code ENOENT", async () => {
      await expect(subject.files.realpath(path("missing", "x"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    });

    contractCase("C20", "does not call a missing path executable", async () => {
      expect(await subject.files.isExecutable(path("missing.sh"))).toBe(false);
    });

    contractCase(
      "C21",
      "keeps a directory, empty and listable, after its last file is deleted",
      async () => {
        await subject.files.writeFile(path("d", "f.txt"), "x");

        await subject.files.deleteFile(path("d", "f.txt"));

        expect(await subject.files.fileExists(path("d"))).toBe(true);
        expect(await subject.files.listDirectory(path("d"))).toStrictEqual([]);
      }
    );
  });
}
