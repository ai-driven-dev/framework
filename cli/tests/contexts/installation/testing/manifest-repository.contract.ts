import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  InvalidManifestDataError,
  InvalidManifestToolIdError,
  ManifestMigrationError,
  ManifestUnavailableError,
  UnsupportedManifestVersionError,
} from "../../../../src/contexts/installation/contract/installation.error.js";
import type {
  ScopeRecords,
  ToolRecords,
} from "../../../../src/contexts/installation/contract/records/scope-records.js";
import type { ManifestRepository } from "../../../../src/contexts/installation/ports/manifest-repository.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../src/shared/domain/installation-file.js";
import { atomicWriteFile } from "../../../../src/shared/infrastructure/atomic-write.js";
import type { AtomicWrite } from "../../../../src/shared/ports/file-writer.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../shared/testing/saying.builder.js";
import { aManifest } from "./manifest.builder.js";

/** What a contract run needs from one implementation of the repository. */
export interface ManifestRepositorySubject {
  readonly repository: ManifestRepository & ScopeRecords;
  /** The manifest file this implementation names. */
  readonly manifestPath: string;
  dispose(): Promise<void>;
}

/** A real adapter, whose file a case writes raw and reopens through another writer. */
export interface ManifestFileSubject extends ManifestRepositorySubject {
  /** How a version refusal names where the file is, and the command reinstalling it. */
  readonly refusal: { readonly location: string; readonly reinstall: string };
  /** The same file, its manifest and its records, written through `atomicWriter`. */
  reopen(atomicWriter: AtomicWrite): ManifestRepository & ScopeRecords;
}

const installedFile = new InstallationFile({
  relativePath: ".claude/rules/a.md",
  content: "content",
  hash: new FileHash("a".repeat(32)),
});

const slashed = (path: string): string => path.replaceAll("\\", "/");

const records: ToolRecords = new Map([
  [TOOL.claude, { binary: "claude", pluginClaims: [{ ref: "a@b", dependents: ["/project"] }] }],
  [TOOL.codex, { pluginClaims: [{ ref: "c@d", dependents: [] }] }],
]);

/**
 * What the repository promises, stated once and run against every implementation of it. A case
 * red on the real adapter is a wrong case; red on the fake, a lie the fake tells. A document the
 * fake cannot hold stays with `describeManifestFileContract`: it stores objects, never JSON.
 */
export function describeManifestRepositoryContract(
  subjectName: string,
  makeSubject: () => Promise<ManifestRepositorySubject>
): void {
  describe(`when the manifest repository is ${subjectName}`, () => {
    let subject: ManifestRepositorySubject;

    beforeEach(async () => {
      subject = await makeSubject();
    });

    afterEach(async () => {
      await subject.dispose();
    });

    it("loads null when no manifest was saved", async () => {
      expect(await subject.repository.load()).toBeNull();
    });

    it("loads back what was saved", async () => {
      const saved = aManifest().withTool(TOOL.claude, [installedFile]).build();

      await subject.repository.save(saved);

      expect((await subject.repository.load())?.toJSON()).toStrictEqual(saved.toJSON());
    });

    it("loads null once the manifest is deleted", async () => {
      await subject.repository.save(aManifest().build());

      await subject.repository.delete();

      expect(await subject.repository.load()).toBeNull();
    });

    it("names its manifest file", () => {
      expect(slashed(subject.repository.path)).toBe(slashed(subject.manifestPath));
    });

    it("loads no records when none were saved", async () => {
      expect(await subject.repository.loadRecords()).toStrictEqual(new Map());
    });

    it("loads back the records saved, a record holding only claims among them", async () => {
      await subject.repository.saveRecords(records);

      expect(await subject.repository.loadRecords()).toStrictEqual(records);
    });

    it("keeps the records apart from the manifest, which a save leaves untouched", async () => {
      await subject.repository.saveRecords(records);

      await subject.repository.save(aManifest().build());

      expect(await subject.repository.loadRecords()).toStrictEqual(records);
    });

    it("deletes the records with the manifest", async () => {
      await subject.repository.save(aManifest().build());
      await subject.repository.saveRecords(records);

      await subject.repository.delete();

      expect(await subject.repository.loadRecords()).toStrictEqual(new Map());
    });
  });
}

/**
 * What the real adapters promise about the document on disk: the versions they read, refuse and
 * split, and what a corrupted file answers.
 */
export function describeManifestFileContract(
  subjectName: string,
  makeSubject: () => Promise<ManifestFileSubject>
): void {
  describe(`when the manifest file is ${subjectName}`, () => {
    let subject: ManifestFileSubject;
    const dir = () => dirname(subject.manifestPath);
    const write = async (content: string) => {
      await mkdir(dir(), { recursive: true });
      await writeFile(subject.manifestPath, content);
    };
    const onDisk = async () => JSON.parse(await readFile(subject.manifestPath, "utf-8"));
    const v8Capture = () =>
      readFile(join(__dirname, "../../../fixtures/manifests/native-registrations.json"), "utf-8");
    const v8Record = async () => JSON.parse(await v8Capture()).tools.claude.nativeRegistrations;

    beforeEach(async () => {
      subject = await makeSubject();
    });

    afterEach(async () => {
      await subject.dispose();
    });

    it("writes the manifest as indented JSON", async () => {
      const saved = aManifest().withTool(TOOL.claude, [installedFile]).build();

      await subject.repository.save(saved);

      expect(await readFile(subject.manifestPath, "utf-8")).toBe(
        JSON.stringify(saved.toJSON(), null, 2)
      );
    });

    it("reads a version 9 document as it is", async () => {
      await write(JSON.stringify({ version: 9, tools: {} }));

      expect((await subject.repository.load())?.toJSON()).toStrictEqual({ version: 9, tools: {} });
    });

    it("refuses a version 7 document, naming the file to delete and the reinstall", async () => {
      await write('{"version": 7, "tools": {}}');

      await expect(subject.repository.load()).rejects.toThrow(
        saying(
          `delete ${subject.manifestPath} ${subject.refusal.location}, then run ` +
            `\`${subject.refusal.reinstall}\` to reinstall the framework.`
        )
      );
    });

    it("refuses a version 6 document, naming the published CLI that wrote it", async () => {
      await write('{"version": 6, "tools": {}}');

      await expect(subject.repository.load()).rejects.toThrow(saying(/5\.2\.2.*clean --force/));
    });

    it("names a corrupted document as a corrupted manifest", async () => {
      await write('{"version": 9, "tools": {');

      const failure = await subject.repository.load().catch((e: unknown) => e);

      expect(failure).toBeInstanceOf(ManifestUnavailableError);
      expect(failure).toMatchObject({
        code: "manifest-corrupted",
        detail: expect.stringContaining(`${subject.manifestPath} is not valid JSON`),
        cause: expect.any(InvalidManifestDataError),
      });
    });

    it("names a document of the wrong shape as a corrupted manifest", async () => {
      await write('{"version": 9, "tools": "x"}');

      await expect(subject.repository.load()).rejects.toMatchObject({
        code: "manifest-corrupted",
        detail: "tools: expected an object.",
        cause: expect.any(InvalidManifestDataError),
      });
    });

    it("names an unknown tool key as a corrupted manifest", async () => {
      await write('{"version": 9, "tools": {"zed": {}}}');

      await expect(subject.repository.load()).rejects.toMatchObject({
        code: "manifest-corrupted",
        detail: "tools.zed: unknown tool id.",
        cause: expect.any(InvalidManifestToolIdError),
      });
    });

    it("names a file it cannot read as unreadable, with its path and the reason", async () => {
      await mkdir(subject.manifestPath, { recursive: true });

      await expect(subject.repository.load()).rejects.toMatchObject({
        code: "manifest-unreadable",
        path: subject.manifestPath,
        reason: "EISDIR",
      });
    });

    it("keeps a version from a newer CLI apart from a corrupted manifest", async () => {
      await write('{"version": 999, "tools": {}}');

      await expect(subject.repository.load()).rejects.toBeInstanceOf(
        UnsupportedManifestVersionError
      );
    });

    describe("a version 8 document", () => {
      let v8: string;
      const besideIt = async () =>
        (await readdir(dir())).filter(
          (name) => slashed(join(dir(), name)) !== slashed(subject.manifestPath)
        );
      const counting = (writes: string[]) => async (path: string, content: string) => {
        writes.push(slashed(path));
        await atomicWriteFile(path, content);
      };

      beforeEach(async () => {
        v8 = await v8Capture();
        await write(v8);
      });

      it("is read as v9 without the record, the record as its own, and nothing written", async () => {
        const loaded = await subject.repository.load();
        const records = await subject.repository.loadRecords();

        const { nativeRegistrations, ...entry } = JSON.parse(v8).tools.claude;
        expect(loaded?.toJSON()).toStrictEqual({ version: 9, tools: { claude: entry } });
        expect(records).toStrictEqual(new Map([[TOOL.claude, nativeRegistrations]]));
        expect(await readFile(subject.manifestPath, "utf-8")).toBe(v8);
        expect(await besideIt()).toStrictEqual([]);
      });

      it("moves a user plugin's dependents into the claims, the manifest no longer carrying them", async () => {
        const document = JSON.parse(v8);
        const entry = document.tools.claude;
        entry.plugins.push({
          ...entry.plugins[0],
          name: "aidd-vcs",
          scope: "user",
          dependents: ["/project-a", "/project-b"],
        });
        await write(JSON.stringify(document));

        const loaded = await subject.repository.load();

        const pluginClaim = { plugin: "aidd-vcs", dependents: ["/project-a", "/project-b"] };
        const record = (await subject.repository.loadRecords()).get(TOOL.claude);
        expect(record?.pluginClaims).toStrictEqual([
          ...entry.nativeRegistrations.pluginClaims,
          pluginClaim,
        ]);
        expect(JSON.stringify(loaded?.toJSON())).not.toContain("dependents");
      });

      it("is written as v9 by its first save, each file once, the records before the manifest", async () => {
        const writes: string[] = [];
        const repository = subject.reopen(counting(writes));

        await repository.save((await repository.load()) ?? aManifest().build());
        await repository.save((await repository.load()) ?? aManifest().build());

        expect(writes.at(-1)).toBe(slashed(subject.manifestPath));
        expect(writes.filter((path) => path === slashed(subject.manifestPath))).toHaveLength(2);
        expect(new Set(writes).size).toBe(writes.length - 1);
        expect((await onDisk()).version).toBe(9);
        expect((await subject.repository.loadRecords()).get(TOOL.claude)).toStrictEqual(
          await v8Record()
        );
      });

      it("is written as v9 by a first save of the records, the manifest after them", async () => {
        const writes: string[] = [];

        await subject.reopen(counting(writes)).saveRecords(records);

        expect(writes.at(-1)).toBe(slashed(subject.manifestPath));
        expect((await subject.repository.load())?.getInstalledToolIds()).toStrictEqual([
          TOOL.claude,
        ]);
        expect((await onDisk()).version).toBe(9);
        expect(await subject.repository.loadRecords()).toStrictEqual(records);
      });

      it("stays as it came when its first save cannot be written, the files beside it ignored", async () => {
        const failing = subject.reopen(async (path, content) => {
          if (slashed(path) === slashed(subject.manifestPath)) throw new Error("disk full");
          await atomicWriteFile(path, content);
        });

        await expect(failing.saveRecords(records)).rejects.toThrow(ManifestMigrationError);
        expect((await subject.repository.loadRecords()).get(TOOL.claude)).toStrictEqual(
          await v8Record()
        );
        await expect(failing.save(aManifest().build())).rejects.toThrow(ManifestMigrationError);

        expect(await readFile(subject.manifestPath, "utf-8")).toBe(v8);
      });
    });

    it("removes the record files with the manifest", async () => {
      await subject.repository.save(aManifest().build());
      await subject.repository.saveRecords(records);

      await subject.repository.delete();

      const left = await readdir(dir()).catch(() => []);
      expect(left.filter((name) => name.endsWith(".json"))).toStrictEqual([]);
    });
  });
}
