import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonParseError } from "../../../src/shared/domain/shared.error.js";
import type { ToolIdResolver } from "../../../src/shared/domain/tool.js";
import { atomicWriteFile } from "../../../src/shared/infrastructure/atomic-write.js";
import { ToolKeyedJsonFile } from "../../../src/shared/infrastructure/tool-keyed-json-file.js";
import type { AtomicWrite } from "../../../src/shared/ports/file-writer.js";
import { SYNTHETIC_TOOL } from "../testing/synthetic-tool-id.builder.js";

const resolveToolId: ToolIdResolver = (raw) => (raw === SYNTHETIC_TOOL ? SYNTHETIC_TOOL : null);
const readNumber = (value: unknown) => (typeof value === "number" ? value : null);

describe("keeping per-tool values in a JSON file", () => {
  let dir: string;
  let path: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "aidd-tool-keyed-"));
    path = join(dir, "nested", "values.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const file = (atomicWriter: AtomicWrite = atomicWriteFile) =>
    new ToolKeyedJsonFile(() => path, { atomicWriter, resolveToolId }, readNumber);

  const written = async (content: string) => {
    await mkdir(join(dir, "nested"), { recursive: true });
    await writeFile(path, content);
  };

  it("reads no file as no values", async () => {
    expect(await file().load()).toStrictEqual(new Map());
  });

  it("loads back what it saved, creating the directory it lives in", async () => {
    await file().save(new Map([[SYNTHETIC_TOOL, 3]]));

    expect(await file().load()).toStrictEqual(new Map([[SYNTHETIC_TOOL, 3]]));
    expect(JSON.parse(await readFile(path, "utf-8"))).toStrictEqual({ [SYNTHETIC_TOOL]: 3 });
  });

  it("writes through the writer it was given", async () => {
    const writes: string[] = [];

    await file(async (target) => {
      writes.push(target);
    }).save(new Map([[SYNTHETIC_TOOL, 3]]));

    expect(writes).toStrictEqual([path]);
  });

  it("removes the file when saving none", async () => {
    await file().save(new Map([[SYNTHETIC_TOOL, 3]]));

    await file().save(new Map());

    expect(await readdir(join(dir, "nested"))).toStrictEqual([]);
  });

  it.each([
    ["a key no tool resolves to", `{ "no-such-tool": 3 }`, `"no-such-tool" names no tool`],
    ["a value it cannot read", `{ "${SYNTHETIC_TOOL}": "three" }`, "is not readable"],
    ["a document that is not an object", "[]", "it is not an object keyed by tool"],
    ["a document that is not JSON", "{", "JSON"],
  ])("refuses the whole file for %s, naming it", async (_case, content, reason) => {
    await written(content);

    const refusal = await file()
      .load()
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(JsonParseError);
    expect(refusal).toMatchObject({ path, reason: expect.stringContaining(reason) });
  });
});
