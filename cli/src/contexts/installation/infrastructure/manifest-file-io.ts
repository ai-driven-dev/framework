import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { errorMessage } from "../../../shared/domain/describe-error.js";
import {
  isErrnoException,
  type ParsedJson,
  tryParseJson,
  whenAbsent,
} from "../../../shared/domain/reading/json-file.js";
import type { ToolIdResolver } from "../../../shared/domain/tool.js";
import type { AtomicWrite } from "../../../shared/ports/file-writer.js";
import {
  InvalidManifestDataError,
  InvalidManifestToolIdError,
  ManifestMigrationError,
  ManifestUnavailableError,
  ManifestUnreadableError,
} from "../contract/installation.error.js";
import type { ScopeRecords, ToolRecords } from "../contract/records/scope-records.js";
import type { ManifestFileContext } from "../domain/manifest/assert-supported-version.js";
import { isV8Manifest, splitV8Manifest } from "../domain/manifest/v8-manifest.js";
import { Manifest } from "../domain/manifest.js";
import { MANIFEST_VERSION } from "../domain/manifest-serialization.js";

/** What a manifest file is read and written with, whichever scope holds it. */
export interface ManifestFileDeps {
  readonly atomicWriter: AtomicWrite;
  readonly resolveToolId: ToolIdResolver;
  /** Where the scope's records are kept beside the manifest. Saving none removes what was kept. */
  readonly records: {
    load(): Promise<ToolRecords>;
    save(records: ToolRecords): Promise<void>;
  };
}

/** The manifest a document holds, and the records it carried inline when it is v8. */
interface Read {
  readonly manifest: Manifest;
  readonly v8Records?: ToolRecords;
}

/**
 * The one place a manifest file's bytes are read, parsed and written, with the records kept beside
 * it. The project and user-scope adapters differ only in which path they read and what a
 * version-refusal message should name to fix it (`ManifestFileContext`).
 *
 * A v8 document is read as v9 in memory, its inline records as the scope's records, and reading it
 * writes nothing. Its first save writes the v9 form: the records, then the manifest, each atomically.
 * The v8 document stays until that last write and stays the records' source until then, so a save
 * cut short leaves the scope as it was.
 */
export abstract class ManifestFile implements ScopeRecords {
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

  /** Null when there is no file. Any other failure to have the manifest is named, never raw. */
  async load(): Promise<Manifest | null> {
    return (await this.readNamed())?.manifest ?? null;
  }

  async loadRecords(): Promise<ToolRecords> {
    return (await this.readNamed())?.v8Records ?? this.deps.records.load();
  }

  /** Writes over a manifest that cannot be read, never over a v8 one before its records. */
  async save(manifest: Manifest): Promise<void> {
    const v8Records = await this.inlineRecords();
    if (v8Records === undefined) return this.write(manifest);
    await this.migrating(async () => {
      await this.deps.records.save(v8Records);
      await this.write(manifest);
    });
  }

  async saveRecords(records: ToolRecords): Promise<void> {
    const read = await this.readNamed();
    if (read?.v8Records === undefined) return this.deps.records.save(records);
    await this.migrating(async () => {
      await this.deps.records.save(records);
      await this.write(read.manifest);
    });
  }

  private readNamed(): Promise<Read | null> {
    return this.read().catch((error: unknown) => failNamed(error, this.path));
  }

  private async read(): Promise<Read | null> {
    const context = this.context();
    const parsed = await readDocument(context.path);
    if (parsed === null) return null;
    if (!parsed.ok) {
      throw new InvalidManifestDataError(
        `${context.path} is not valid JSON: ${errorMessage(parsed.error)}`
      );
    }
    const document = parsed.value;
    if (!isV8Manifest(document))
      return { manifest: Manifest.fromJSON(document, this.deps.resolveToolId, context) };
    const { tools, records } = splitV8Manifest(document, this.deps.resolveToolId);
    const manifest = Manifest.fromJSON(
      { ...document, version: MANIFEST_VERSION, tools },
      this.deps.resolveToolId,
      context
    );
    return { manifest, v8Records: records };
  }

  /** The records a v8 document carries inline. None for any other file, which a save writes over. */
  private async inlineRecords(): Promise<ToolRecords | undefined> {
    const parsed = await readDocument(this.path);
    if (!parsed?.ok || !isV8Manifest(parsed.value)) return undefined;
    return splitV8Manifest(parsed.value, this.deps.resolveToolId).records;
  }

  private async migrating(writes: () => Promise<void>): Promise<void> {
    try {
      await writes();
    } catch (error) {
      throw new ManifestMigrationError(this.path, errorMessage(error));
    }
  }

  private async write(manifest: Manifest): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await this.deps.atomicWriter(this.path, JSON.stringify(manifest.toJSON(), null, 2));
  }
}

/** What a failed read means to the person: the file is corrupted, the system refused to read it, or
 * something else this CLI refuses by its own name (a version) or has no name for. */
function failNamed(error: unknown, path: string): never {
  if (error instanceof InvalidManifestDataError) {
    throw new ManifestUnavailableError("manifest-corrupted", {
      cause: error,
      detail: error.detail,
      path,
    });
  }
  if (error instanceof InvalidManifestToolIdError) {
    throw new ManifestUnavailableError("manifest-corrupted", {
      cause: error,
      detail: `tools.${error.key}: unknown tool id.`,
      path,
    });
  }
  if (isErrnoException(error) && error.syscall !== undefined && error.code !== undefined) {
    throw new ManifestUnreadableError(path, error.code, { cause: error });
  }
  throw error;
}

/** The file parsed, or null when there is no file. */
async function readDocument(path: string): Promise<ParsedJson | null> {
  const raw = await whenAbsent(() => readFile(path, "utf-8"), null);
  return raw === null ? null : tryParseJson(raw);
}
