import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os, { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOSTS, load } from "./testing/hooks-runtime-host.builder.js";

const posix = process.platform !== "win32";
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "aidd-own-folder-"));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

const ownFolder = (host: string) => load(host).ownFolder;

describe.each(HOSTS)("%s's adapter, the folder only this user may use", (host) => {
  it("creates it closed to others when asked to", { skip: !posix }, () => {
    const folder = join(root, "state");

    expect(ownFolder(host)(folder, true)).toBe(true);
    expect(statSync(folder).mode & 0o777).toBe(0o700);
  });

  it("does not create it when not asked to", () => {
    const folder = join(root, "state");

    expect(ownFolder(host)(folder, false)).toBe(false);
    expect(() => statSync(folder)).toThrow();
  });

  it("does not create its missing parent", () => {
    expect(ownFolder(host)(join(root, "missing", "state"), true)).toBe(false);
  });

  it("accepts a folder it finds already closed to others", { skip: !posix }, () => {
    const folder = join(root, "state");
    mkdirSync(folder, { mode: 0o700 });

    expect([ownFolder(host)(folder, false), ownFolder(host)(folder, true)]).toStrictEqual([
      true,
      true,
    ]);
  });

  it("refuses a folder others can enter", { skip: !posix }, () => {
    const folder = join(root, "state");
    mkdirSync(folder);
    chmodSync(folder, 0o755);

    expect(ownFolder(host)(folder, true)).toBe(false);
  });

  it("refuses a file in its place", () => {
    const folder = join(root, "state");
    writeFileSync(folder, "", { mode: 0o700 });

    expect(ownFolder(host)(folder, true)).toBe(false);
  });

  it("refuses a link to a folder", { skip: !posix }, () => {
    const target = join(root, "target");
    mkdirSync(target, { mode: 0o700 });
    symlinkSync(target, join(root, "state"));

    expect(ownFolder(host)(join(root, "state"), true)).toBe(false);
  });

  it("refuses a folder another user owns", { skip: !posix }, () => {
    const folder = join(root, "state");
    mkdirSync(folder, { mode: 0o700 });
    vi.spyOn(process, "getuid").mockReturnValue((process.getuid?.() ?? 0) + 1);

    expect(ownFolder(host)(folder, false)).toBe(false);
  });
});

describe.each(HOSTS)("%s's adapter, the state folder of a hook", (host) => {
  const hooksFolder = (name: string, create: boolean) => load(host).hooksFolder(name, create);
  const uid = process.getuid?.();
  const hooksName = uid === undefined ? "aidd-hooks" : `aidd-hooks-${uid}`;

  beforeEach(() => {
    vi.spyOn(os, "tmpdir").mockReturnValue(root);
  });

  it("is the named folder under this user's hooks folder, both created when asked to", () => {
    expect(hooksFolder("aidd-ui", true)).toBe(join(root, hooksName, "aidd-ui"));
    expect(statSync(join(root, hooksName, "aidd-ui")).isDirectory()).toBe(true);
  });

  it("is none when missing and not asked to create it", () => {
    expect(hooksFolder("aidd-ui", false)).toBeNull();
    expect(() => statSync(join(root, hooksName))).toThrow();
  });

  it("is none when the hooks folder above it is open to others", { skip: !posix }, () => {
    mkdirSync(join(root, hooksName));
    chmodSync(join(root, hooksName), 0o755);

    expect(hooksFolder("aidd-ui", true)).toBeNull();
  });
});
