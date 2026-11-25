import { describe, expect, it } from "vitest";
import { UpdateGitignore } from "../../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";

const ROOT = "/project";
const GITIGNORE = "/project/.gitignore";

function build(existing?: string) {
  const fs = new InMemoryFileAdapter(existing === undefined ? {} : { [GITIGNORE]: existing });
  return { fs, useCase: new UpdateGitignore(fs) };
}

describe("updating a project's gitignore", () => {
  describe("adding entries to the gitignore", () => {
    it("creates the file from the entries, one per line, ending with a newline", async () => {
      const { fs, useCase } = build();

      await expect(useCase.execute(ROOT, ["a/", "b/"])).resolves.toBe(true);

      expect(fs.getFile(GITIGNORE)).toBe("a/\nb/\n");
    });

    it("starts a new line before appending to a file without a trailing newline", async () => {
      const { fs, useCase } = build("keep");

      await useCase.execute(ROOT, ["a/"]);

      expect(fs.getFile(GITIGNORE)).toBe("keep\na/\n");
    });

    it("appends right after a trailing newline, without a blank line", async () => {
      const { fs, useCase } = build("keep\n");

      await useCase.execute(ROOT, ["a/"]);

      expect(fs.getFile(GITIGNORE)).toBe("keep\na/\n");
    });

    it("answers false and leaves the file alone when every entry is already there", async () => {
      const { fs, useCase } = build("a/\n");

      await expect(useCase.execute(ROOT, ["a/"])).resolves.toBe(false);

      expect(fs.getFile(GITIGNORE)).toBe("a/\n");
    });

    it("counts an entry written with surrounding whitespace as present", async () => {
      const { fs, useCase } = build("  a/  \n");

      await expect(useCase.execute(ROOT, ["a/"])).resolves.toBe(false);

      expect(fs.getFile(GITIGNORE)).toBe("  a/  \n");
    });

    it("appends only the entries that are missing", async () => {
      const { fs, useCase } = build("a/\nb/\n");

      await expect(useCase.execute(ROOT, ["b/", "c/"])).resolves.toBe(true);

      expect(fs.getFile(GITIGNORE)).toBe("a/\nb/\nc/\n");
    });
  });

  describe("removing an entry from the gitignore", () => {
    it("does nothing when there is no file", async () => {
      const { fs, useCase } = build();

      await expect(useCase.execute(ROOT, ["a/"], "remove")).resolves.toBe(false);

      expect(fs.has(GITIGNORE)).toBe(false);
    });

    it("drops the entry and keeps the other lines in order", async () => {
      const { fs, useCase } = build("a/\nb/\nc/\n");

      expect(await useCase.execute(ROOT, ["b/"], "remove")).toBe(true);

      expect(fs.getFile(GITIGNORE)).toBe("a/\nc/\n");
    });

    it("drops an entry written with surrounding whitespace", async () => {
      const { fs, useCase } = build("  b/  \nc/\n");

      await useCase.execute(ROOT, ["b/"], "remove");

      expect(fs.getFile(GITIGNORE)).toBe("c/\n");
    });

    it("leaves the file byte-identical when no entry matches", async () => {
      const { fs, useCase } = build("\na/\n\n");

      expect(await useCase.execute(ROOT, ["z/"], "remove")).toBe(false);

      expect(fs.getFile(GITIGNORE)).toBe("\na/\n\n");
    });

    it("leaves an empty file in place when no entry matches", async () => {
      const { fs, useCase } = build("");

      await useCase.execute(ROOT, ["z/"], "remove");

      expect(fs.getFile(GITIGNORE)).toBe("");
    });

    it("collapses the blank lines around what remains", async () => {
      const { fs, useCase } = build("\n\nb/\na/\nc/\n\n");

      await useCase.execute(ROOT, ["b/"], "remove");

      expect(fs.getFile(GITIGNORE)).toBe("a/\nc/\n");
    });

    it("deletes the file once its last entry is removed", async () => {
      const { fs, useCase } = build("a/\n");

      await useCase.execute(ROOT, ["a/"], "remove");

      expect(fs.has(GITIGNORE)).toBe(false);
    });
  });
});
