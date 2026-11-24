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
      beforeEach(async () => {
        await write(await v8Capture());
      });

      it("is split on its first load: a v9 manifest without the record, and the record beside it", async () => {
        const loaded = await subject.repository.load();

        const v8 = JSON.parse(await v8Capture());
        const { nativeRegistrations, ...entry } = v8.tools.claude;
        expect(loaded?.toJSON()).toStrictEqual({ version: 9, tools: { claude: entry } });
        expect(await onDisk()).toStrictEqual({ version: 9, tools: { claude: entry } });
        expect(await subject.repository.loadRecords()).toStrictEqual(
          new Map([[TOOL.claude, nativeRegistrations]])
        );
      });

      it("moves a user plugin's dependents into the claims, the saved manifest no longer carrying them", async () => {
        const v8 = JSON.parse(await v8Capture());
        const entry = v8.tools.claude;
        entry.plugins.push({
          ...entry.plugins[0],
          name: "aidd-vcs",
          scope: "user",
          dependents: ["/project-a", "/project-b"],
        });
        await write(JSON.stringify(v8));

        const loaded = await subject.repository.load();

        const pluginClaim = { plugin: "aidd-vcs", dependents: ["/project-a", "/project-b"] };
        const record = (await subject.repository.loadRecords()).get(TOOL.claude);
        expect(record?.pluginClaims).toStrictEqual([
          ...v8.tools.claude.nativeRegistrations.pluginClaims,
          pluginClaim,
        ]);
        const saved = (await onDisk()).tools.claude.plugins;
        expect(saved.map((plugin: object) => "dependents" in plugin)).toStrictEqual([false, false]);
        expect(JSON.stringify(loaded?.toJSON())).not.toContain("dependents");
      });

      it("is split by a first read of the records alone", async () => {
        expect((await subject.repository.loadRecords()).get(TOOL.claude)).toStrictEqual(
          await v8Record()
        );
        expect((await onDisk()).version).toBe(9);
      });

      it("is split before records are saved over it, so neither the manifest nor the save is lost", async () => {
        await subject.repository.saveRecords(records);

        expect((await subject.repository.load())?.getInstalledToolIds()).toStrictEqual([
          TOOL.claude,
        ]);
        expect(await subject.repository.loadRecords()).toStrictEqual(records);
      });

      it("writes the records before the manifest", async () => {
        const writes: string[] = [];

        await subject
          .reopen(async (path, content) => {
            writes.push(slashed(path));
            await atomicWriteFile(path, content);
          })
          .load();

        expect(writes.at(-1)).toBe(slashed(subject.manifestPath));
        expect(writes.length).toBeGreaterThan(1);
      });

      it("stays as it came when its split cannot be written, and the split runs again", async () => {
        const before = await readFile(subject.manifestPath, "utf-8");
        const failing = subject.reopen(async (path, content) => {
          if (slashed(path) === slashed(subject.manifestPath)) throw new Error("disk full");
          await atomicWriteFile(path, content);
        });

        await expect(failing.load()).rejects.toThrow(ManifestMigrationError);
        await expect(failing.save(aManifest().build())).rejects.toThrow(ManifestMigrationError);
        expect(await readFile(subject.manifestPath, "utf-8")).toBe(before);

        await subject.repository.load();
        expect((await onDisk()).version).toBe(9);
        expect((await subject.repository.loadRecords()).get(TOOL.claude)).toStrictEqual(
          await v8Record()
        );
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
