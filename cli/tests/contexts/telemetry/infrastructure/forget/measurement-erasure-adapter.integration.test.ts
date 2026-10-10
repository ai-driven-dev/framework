import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MeasurementErasureAdapter } from "../../../../../src/contexts/telemetry/infrastructure/forget/measurement-erasure-adapter.js";
import { assertUnderTemporaryDirectory } from "../../../../helpers/telemetry-sandbox.js";

let root: string;
let telemetry: string;
let sink: string;
let identity: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "aidd-erasure-")));
  telemetry = join(root, "telemetry");
  sink = join(root, "previous-sink");
  identity = join(root, "previous-identity.json");
  assertUnderTemporaryDirectory([telemetry, sink, identity]);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const erasure = (dir = telemetry) =>
  new MeasurementErasureAdapter(dir, { sinkDirs: [sink], identityFiles: [identity] });
const write = (path: string) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "x\n");
};

describe("what measurement keeps", () => {
  it("is nothing where nothing was written, and creates nothing", async () => {
    expect(await erasure().inventory()).toEqual([]);
    expect(existsSync(telemetry)).toBe(false);
  });

  it("is nothing where the directory is a file", async () => {
    writeFileSync(telemetry, "x");
    expect(await erasure(join(telemetry, "inside")).inventory()).toEqual([]);
  });

  it("lists the files of both versions, the ledger last, day files in date order", async () => {
    write(join(telemetry, "ledger", "2026-10.jsonl"));
    write(join(telemetry, "bindings", "sessions.jsonl"));
    write(join(telemetry, "identity.json"));
    write(join(sink, "2026-10-06.jsonl"));
    write(join(sink, "2026-10-05.jsonl"));
    write(identity);
    const found = await erasure().inventory();
    expect(found.map((e) => [e.kind, e.path.replace(root, "")])).toEqual([
      ["bindings", join("/", "telemetry", "bindings")],
      ["identity", join("/", "telemetry", "identity.json")],
      ["previous-day-file", join("/", "previous-sink", "2026-10-05.jsonl")],
      ["previous-day-file", join("/", "previous-sink", "2026-10-06.jsonl")],
      ["previous-identity", join("/", "previous-identity.json")],
      ["ledger", join("/", "telemetry", "ledger")],
    ]);
  });

  it("counts the files a directory holds, nested ones too, and not its lock", async () => {
    write(join(telemetry, "ledger", "a.jsonl"));
    write(join(telemetry, "ledger", "nested", "b.jsonl"));
    write(join(telemetry, "ledger", "nested", "deeper", "c.jsonl"));
    write(join(telemetry, "ledger", ".lock"));
    const [ledger] = await erasure().inventory();
    expect(ledger?.files).toBe(3);
  });

  it("lists an empty directory it would remove, with no file in it", async () => {
    mkdirSync(join(telemetry, "bindings"), { recursive: true });
    expect(await erasure().inventory()).toEqual([
      { kind: "bindings", path: join(telemetry, "bindings"), files: 0 },
    ]);
  });

  it("names only day files, and only files", async () => {
    write(join(sink, "2026-10-05.jsonl"));
    write(join(sink, "2026-10.jsonl"));
    write(join(sink, "2026-10-05.jsonl.bak"));
    write(join(sink, "x2026-10-05.jsonl"));
    mkdirSync(join(sink, "2026-10-04.jsonl"));
    mkdirSync(join(telemetry, "identity.json"), { recursive: true });
    mkdirSync(identity);
    expect((await erasure().inventory()).map((e) => e.kind)).toEqual(["previous-day-file"]);
  });

  it.skipIf(process.getuid?.() === 0 || process.platform === "win32")(
    "does not take a directory it cannot read for an empty one",
    async () => {
      mkdirSync(sink);
      chmodSync(sink, 0o000);
      try {
        await expect(erasure().inventory()).rejects.toThrow(/EACCES/);
      } finally {
        chmodSync(sink, 0o700);
      }
    }
  );
});

describe("erasing it", () => {
  it("removes what is listed and nothing else", async () => {
    write(join(telemetry, "ledger", "2026-10.jsonl"));
    write(join(telemetry, "ledger", ".lock"));
    write(join(telemetry, "bindings", "carries.jsonl"));
    write(join(telemetry, "identity.json"));
    write(join(telemetry, "notes.txt"));
    write(join(sink, "2026-10-05.jsonl"));
    write(join(sink, "keep.jsonl"));
    write(identity);

    await erasure().erase();

    expect(readdirSync(telemetry)).toEqual(["notes.txt"]);
    expect(readdirSync(sink)).toEqual(["keep.jsonl"]);
    expect(existsSync(identity)).toBe(false);
  });

  it("is quiet where nothing is kept", async () => {
    await expect(erasure().erase()).resolves.toBeUndefined();
  });
});
