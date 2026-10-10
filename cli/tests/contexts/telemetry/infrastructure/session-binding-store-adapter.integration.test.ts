import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { declarationOf } from "../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import { SessionBindingStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/declaration/session-binding-store-adapter.js";
import { PrivateStorageAdapter } from "../../../../src/runtime/filesystem/private-storage-adapter.js";

let root: string;
let dir: string;
let store: SessionBindingStoreAdapter;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "aidd-sessions-"));
  dir = join(root, "bindings");
  store = new SessionBindingStoreAdapter(dir, new PrivateStorageAdapter());
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const declaration = (task: string, iso: string) =>
  declarationOf({ kind: "task", task, ticket: null }, new Date(iso), "command");

describe("the session declarations on disk", () => {
  it("are empty before the first declaration", async () => {
    expect(await store.declarations()).toEqual([]);
    expect(await store.carries()).toEqual([]);
  });

  it("append one line each and keep every one of them, in order", async () => {
    await store.append("s-1", declaration("first", "2026-10-09T10:00:00.000Z"));
    await store.append("s-1", declaration("second", "2026-10-09T11:00:00.000Z"));
    const text = await readFile(join(dir, "sessions.jsonl"), "utf8");
    expect(text.split("\n")).toHaveLength(3);
    expect((await store.declarations()).map((entry) => entry.task)).toEqual(["first", "second"]);
  });

  it.skipIf(process.platform === "win32")("are readable by their owner alone", async () => {
    await store.append("s-1", declaration("t", "2026-10-09T10:00:00.000Z"));
    expect((await stat(join(dir, "sessions.jsonl"))).mode & 0o777).toBe(0o600);
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
  });

  it("start on a line of their own after a crash left no newline", async () => {
    await store.append("s-1", declaration("first", "2026-10-09T10:00:00.000Z"));
    const path = join(dir, "sessions.jsonl");
    await writeFile(path, (await readFile(path, "utf8")).trimEnd());
    await store.append("s-1", declaration("second", "2026-10-09T11:00:00.000Z"));
    expect((await store.declarations()).map((entry) => entry.task)).toEqual(["first", "second"]);
  });

  it("skip a line that is not a declaration", async () => {
    await store.append("s-1", declaration("first", "2026-10-09T10:00:00.000Z"));
    const path = join(dir, "sessions.jsonl");
    await writeFile(path, `garbage\n${await readFile(path, "utf8")}{"half":`);
    expect((await store.declarations()).map((entry) => entry.task)).toEqual(["first"]);
  });
});

describe("the carries on disk", () => {
  it("are read from the file a hook writes, whole lines only", async () => {
    await store.append("s-1", declaration("t", "2026-10-09T10:00:00.000Z"));
    await writeFile(
      join(dir, "carries.jsonl"),
      `${JSON.stringify({ session_id: "b", from: "a", at: "2026-10-09T12:00:00.000Z" })}\nnot json\n`
    );
    expect(await store.carries()).toEqual([
      { session_id: "b", from: "a", at: "2026-10-09T12:00:00.000Z" },
    ]);
  });
});
