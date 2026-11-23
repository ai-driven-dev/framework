import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { errorMessage } from "../../../shared/domain/describe-error.js";
import { tryParseJson, whenAbsent } from "../../../shared/domain/reading/json-file.js";
import type { ToolIdResolver } from "../../../shared/domain/tool.js";
import type { AtomicWrite } from "../../../shared/ports/file-writer.js";
import {
  InvalidManifestDataError,
  ManifestMigrationError,
  ManifestUnavailableError,
} from "../contract/installation.error.js";
import type { ToolRecords } from "../contract/records/scope-records.js";
import type { ManifestFileContext } from "../domain/manifest/assert-supported-version.js";
import { isV8Manifest, splitV8Manifest } from "../domain/manifest/v8-manifest.js";
import { Manifest } from "../domain/manifest.js";
import { MANIFEST_VERSION } from "../domain/manifest-serialization.js";

/** What a manifest file is read and written with, whichever scope holds it. */
export interface ManifestFileDeps {
  readonly atomicWriter: AtomicWrite;
  readonly resolveToolId: ToolIdResolver;
  /** Where a v8 document's records go when it is split, and what `delete` clears. */
  readonly records: { save(records: ToolRecords): Promise<void> };
}

/**
 * The one place a manifest file's bytes are read, parsed and written. The records beside it are
 * written here only by a v8 split and cleared only by `delete`; composition reads and writes them.
 * The project and user-scope adapters differ only in which path they read and what a
 * version-refusal message should name to fix it (`ManifestFileContext`).
 *
 * A v8 document is split on its first read, whichever operation reads it first: the whole document
 * is checked, the records are written, then the v9 manifest. Each write is atomic, and the v8
 * document stays until the last one, so a split cut short runs again from it.
 *
 * Limit: the split takes no lock. Two processes reading the same v8 document at once both split
 * it; each writes the same files from the same document.
 */
export abstract class ManifestFile {
  constructor(protected readonly deps: ManifestFileDeps) {}

  /** The file, and how a version refusal names it. */
  protected abstract context(): ManifestFileContext;

  get path(): string {
    return this.context().path;
  }

  /** Removes the records kept beside the manifest, then the manifest. */
  async delete(): Promise<void> {
    await this.deps.records.save(new Map());
    await rm(this.path, { force: true });
  }

  async load(): Promise<Manifest | null> {
    const context = this.context();
    const file = await readDocument(context.path);
    if (file === null) return null;
    const { document } = file;
    if (!isV8Manifest(document))
      return Manifest.fromJSON(document, this.deps.resolveToolId, context);
    const { tools, records } = splitV8Manifest(document, this.deps.resolveToolId);
    const manifest = Manifest.fromJSON(
      { ...document, version: MANIFEST_VERSION, tools },
      this.deps.resolveToolId,
      context
    );
    await this.writeSplit(manifest, records);
    return manifest;
  }

  /** `load`, an unreadable manifest answered as none. A split that could not be written is not
   * unreadable: answered as none, a caller would write a fresh manifest over the v8 one. */
  async loadIfReadable(): Promise<Manifest | null> {
    return this.load().catch(noneUnlessMigrationFailed);
  }

  async loadForDiagnosis(): Promise<Manifest | null> {
    return this.load().catch(refusedAsCorrupted);
  }

  async save(manifest: Manifest): Promise<void> {
    await this.splitIfV8();
    await this.write(manifest);
  }

  /** Splits a v8 document before the manifest is written over it. */
  private async splitIfV8(): Promise<void> {
    await this.loadIfReadable();
  }

  private async writeSplit(manifest: Manifest, records: ToolRecords): Promise<void> {
    try {
      await this.deps.records.save(records);
      await this.write(manifest);
    } catch (error) {
      throw new ManifestMigrationError(this.path, errorMessage(error));
    }
  }

  private async write(manifest: Manifest): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await this.deps.atomicWriter(this.path, JSON.stringify(manifest.toJSON(), null, 2));
  }
}

function refusedAsCorrupted(cause: unknown): never {
  throw new ManifestUnavailableError("manifest-corrupted", { cause });
}

function noneUnlessMigrationFailed(error: unknown): null {
  if (error instanceof ManifestMigrationError) throw error;
  return null;
}

/** The parsed document, or null when there is no file. */
async function readDocument(path: string): Promise<{ readonly document: unknown } | null> {
  const raw = await whenAbsent(() => readFile(path, "utf-8"), null);
  if (raw === null) return null;
  const parsed = tryParseJson(raw);
  if (!parsed.ok) {
    throw new InvalidManifestDataError(`${path} is not valid JSON: ${errorMessage(parsed.error)}`);
  }
  return { document: parsed.value };
}
