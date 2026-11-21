import { afterEach, describe, expect, it } from "vitest";
import type { FileMerger } from "../../../../src/contexts/installation/ports/file-merger.js";
import { JsonParseError } from "../../../../src/shared/domain/errors/json-parse-error.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";

export interface FileMergerSubject {
  readonly merger: FileMerger & FileReader & FileWriter;
  /** A path of the subject's own, where a file can be written and merged into. */
  readonly settingsPath: string;
  dispose(): Promise<void>;
}

const json = (value: unknown): string => JSON.stringify(value);

/** What merging a JSON document into a file promises, whatever holds the file. */
export function describeFileMergerContract(
  subjectName: string,
  makeSubject: () => Promise<FileMergerSubject>
): void {
  describe(`when JSON is merged into a file ${subjectName}`, () => {
    const opened: FileMergerSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(existing?: string): Promise<FileMergerSubject> {
      const subject = await makeSubject();
      opened.push(subject);
      if (existing !== undefined) await subject.merger.writeFile(subject.settingsPath, existing);
      return subject;
    }

    async function read(subject: FileMergerSubject): Promise<unknown> {
      return JSON.parse(await subject.merger.readFile(subject.settingsPath));
    }

    it("creates the file with the incoming content when there is none", async () => {
      const subject = await given();

      await subject.merger.mergeJsonFile(subject.settingsPath, json({ a: 1 }), "framework-prime");

      expect(await read(subject)).toStrictEqual({ a: 1 });
    });

    it("keeps the keys already in the file, the framework's value winning a conflict", async () => {
      const subject = await given(json({ kept: "user", shared: "user" }));

      await subject.merger.mergeJsonFile(
        subject.settingsPath,
        json({ shared: "framework" }),
        "framework-prime"
      );

      expect(await read(subject)).toStrictEqual({ kept: "user", shared: "framework" });
    });

    it("refuses a file that is not JSON, and leaves it as it was", async () => {
      const subject = await given("not json");

      await expect(
        subject.merger.mergeJsonFile(subject.settingsPath, json({ a: 1 }), "framework-prime")
      ).rejects.toThrow(JsonParseError);
      expect(await subject.merger.readFile(subject.settingsPath)).toBe("not json");
    });
  });
}
