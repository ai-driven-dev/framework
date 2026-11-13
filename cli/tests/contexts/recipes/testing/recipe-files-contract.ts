import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RecipeFiles } from "../../../../src/contexts/recipes/ports/recipe-files.js";

export interface RecipeFilesSubject {
  readonly files: RecipeFiles;
  /** Where the subject's files live: every path below is relative to it. */
  readonly root: string;
  put(relative: string, content: string): Promise<void>;
  makeDirectory(relative: string): Promise<void>;
  dispose(): Promise<void>;
}

/** What reading and listing recipe files promises, whatever holds them. */
export function describeRecipeFilesContract(
  subjectName: string,
  makeSubject: () => Promise<RecipeFilesSubject>
): void {
  describe(`when the recipe files are ${subjectName}`, () => {
    const opened: RecipeFilesSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(): Promise<RecipeFilesSubject> {
      const subject = await makeSubject();
      opened.push(subject);
      return subject;
    }

    it("reads the content of a file, or none when none is required", async () => {
      const { files, root, put } = await given();
      await put("a.md", "# A");

      expect(files.read(path.join(root, "a.md"))).toStrictEqual({
        kind: "readable",
        content: "# A",
      });
      expect(files.read(path.join(root, "a.md"), false)).toStrictEqual({
        kind: "readable",
        content: "",
      });
    });

    it("answers why a path cannot be read", async () => {
      const { files, root, makeDirectory } = await given();
      await makeDirectory("dir");

      expect(files.read(path.join(root, "missing.md"))).toStrictEqual({
        kind: "unreadable",
        code: "ENOENT",
      });
      expect(files.read(path.join(root, "dir"))).toStrictEqual({
        kind: "unreadable",
        code: "EISDIR",
      });
    });

    it("lists the markdown files of a directory, never README.md, a deeper one nor a directory", async () => {
      const { files, root, put, makeDirectory } = await given();
      await put("dir/b.md", "");
      await makeDirectory("dir/folder.md");
      await put("dir/README.md", "");
      await put("dir/notes.txt", "");
      await put("dir/deeper/c.md", "");

      expect(files.list({ path: path.join(root, "dir"), optional: false })).toStrictEqual([
        path.join(root, "dir", "b.md"),
      ]);
    });

    it("tolerates a missing directory only when it is optional", async () => {
      const { files, root, put } = await given();
      await put("a.md", "");
      const missing = path.join(root, "absent");

      expect(files.list({ path: missing, optional: true })).toStrictEqual([]);
      expect(() => files.list({ path: missing, optional: false })).toThrow(
        expect.objectContaining({ code: "ENOENT" })
      );
      expect(() => files.list({ path: path.join(root, "a.md"), optional: true })).toThrow(
        expect.objectContaining({ code: "ENOTDIR" })
      );
    });
  });
}
