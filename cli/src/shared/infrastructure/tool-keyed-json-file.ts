import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { errorMessage } from "../domain/describe-error.js";
import { tryParseJson, whenAbsent } from "../domain/reading/json-file.js";
import { asPlainObject } from "../domain/reading/plain-object.js";
import { JsonParseError } from "../domain/shared.error.js";
import type { ToolId, ToolIdResolver } from "../domain/tool.js";
import type { AtomicWrite } from "../ports/file-writer.js";

/** What a tool-keyed file is read and written with. */
export interface ToolKeyedJsonFileDeps {
  readonly atomicWriter: AtomicWrite;
  readonly resolveToolId: ToolIdResolver;
}

/**
 * One JSON object holding a value per tool, read and written whole. No file reads as no values,
 * and saving none removes the file. A key no tool resolves to, or a value `readValue` refuses,
 * makes the whole file unreadable: a rewrite would otherwise drop what it could not read.
 */
export class ToolKeyedJsonFile<V> {
  constructor(
    private readonly path: () => string,
    private readonly deps: ToolKeyedJsonFileDeps,
    private readonly readValue: (value: unknown) => V | null
  ) {}

  async load(): Promise<Map<ToolId, V>> {
    const path = this.path();
    const values = new Map<ToolId, V>();
    for (const [key, raw] of Object.entries(await readObject(path))) {
      const toolId = this.deps.resolveToolId(key);
      if (toolId === null) throw new JsonParseError(path, `"${key}" names no tool`);
      const value = this.readValue(raw);
      if (value === null) throw new JsonParseError(path, `the value of "${key}" is not readable`);
      values.set(toolId, value);
    }
    return values;
  }

  async save(values: ReadonlyMap<ToolId, V>): Promise<void> {
    const path = this.path();
    if (values.size === 0) {
      await rm(path, { force: true });
      return;
    }
    await mkdir(dirname(path), { recursive: true });
    await this.deps.atomicWriter(path, JSON.stringify(Object.fromEntries(values), null, 2));
  }
}

async function readObject(path: string): Promise<Record<string, unknown>> {
  const raw = await whenAbsent(() => readFile(path, "utf-8"), "{}");
  const parsed = tryParseJson(raw);
  if (!parsed.ok) throw new JsonParseError(path, errorMessage(parsed.error));
  const object = asPlainObject(parsed.value);
  if (object === null) throw new JsonParseError(path, "it is not an object keyed by tool");
  return object;
}
