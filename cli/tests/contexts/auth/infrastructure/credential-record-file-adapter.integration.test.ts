import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, execFileSync: vi.fn() };
});

import { CredentialRecordFileAdapter } from "../../../../src/contexts/auth/infrastructure/credential-record-file-adapter.js";
import { aStoredRecord } from "../testing/credential-records.js";

/**
 * `process.platform` is a plain value property, so it is redefined rather than spied on; the
 * win32 branch alone shells out, and it needs `USERNAME`, which no POSIX session has.
 */
async function asWin32<T>(run: () => Promise<T>, account = "tester"): Promise<T> {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  const username = process.env.USERNAME;
  Object.defineProperty(process, "platform", { value: "win32", configurable: true });
  process.env.USERNAME = account;
  try {
    return await run();
  } finally {
    if (platform !== undefined) Object.defineProperty(process, "platform", platform);
    if (username === undefined) delete process.env.USERNAME;
    else process.env.USERNAME = username;
  }
}

describe("CredentialRecordFileAdapter", () => {
  let tempDir: string;
  let userDir: string;
  let storage: CredentialRecordFileAdapter;
  const userFile = (): string => join(userDir, "auth.json");
  const stored = { method: "stored" as const, token: "ghp_secret" };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-auth-file-"));
    userDir = tempDir;
    storage = new CredentialRecordFileAdapter(
      tempDir,
      () => userDir,
      () => new Date()
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("read", () => {
    it("returns null when file does not exist", async () => {
      const result = await storage.read("project");
      expect(result).toBeNull();
    });

    it("returns null when file contains invalid JSON", async () => {
      await writeFile(userFile(), "not json");
      const result = await storage.read("user");
      expect(result).toBeNull();
    });

    it("returns null when file contains JSON missing required fields", async () => {
      await writeFile(userFile(), JSON.stringify({ version: 1 }));
      const result = await storage.read("user");
      expect(result).toBeNull();
    });

    it("returns the record when file is valid", async () => {
      const config = aStoredRecord({ token: "ghp_abc123" });
      await writeFile(userFile(), JSON.stringify(config));
      const result = await storage.read("user");
      expect(result).toEqual(config);
    });
  });

  describe("write", () => {
    it("creates parent directories and writes the file", async () => {
      userDir = join(tempDir, "nested", "dir");
      await storage.save({ method: "external", provider: "gh" }, "user");
      const content = await readFile(userFile(), "utf-8");
      expect(JSON.parse(content)).toMatchObject({
        method: "external",
        level: "user",
        provider: "gh",
      });
    });

    it("sets restrictive file permissions on non-Windows", async () => {
      if (process.platform === "win32") return;
      await storage.save(stored, "user");
      const stats = await stat(userFile());
      expect(stats.mode & 0o777).toBe(0o600);
    });

    it.skipIf(process.platform === "win32")(
      "restricts an existing world-readable file to its owner when it rewrites it",
      async () => {
        const path = userFile();
        await writeFile(path, "{}", { mode: 0o644 });
        await chmod(path, 0o644);

        await storage.save(stored, "user");

        expect((await stat(path)).mode & 0o777).toBe(0o600);
      }
    );

    it("restricts the file on win32 through an icacls argument list, never a shell command line", async () => {
      vi.mocked(execFileSync).mockClear();

      await asWin32(() => storage.save({ method: "stored", token: "ghp_win" }, "user"));

      expect(execFileSync).toHaveBeenCalledTimes(1);
      const [command, args] = vi.mocked(execFileSync).mock.calls[0] ?? [];
      expect(command).toBe("icacls");
      expect(args).toStrictEqual([userFile(), "/inheritance:r", "/grant:r", "tester:(R,W)"]);
    });

    it("names the account from the environment, not the %USERNAME% only a shell would expand", async () => {
      vi.mocked(execFileSync).mockClear();

      await asWin32(
        () => storage.save({ method: "stored", token: "ghp_win" }, "user"),
        "Ada Lovelace"
      );

      const args = vi.mocked(execFileSync).mock.calls[0]?.[1];
      expect(args).toContain("Ada Lovelace:(R,W)");
    });

    it("refuses to leave inheritance stripped with no grant when the session names no account", async () => {
      const platform = Object.getOwnPropertyDescriptor(process, "platform");
      const username = process.env.USERNAME;
      Object.defineProperty(process, "platform", { value: "win32", configurable: true });
      delete process.env.USERNAME;
      try {
        await expect(storage.save({ method: "stored", token: "ghp_win" }, "user")).rejects.toThrow(
          /USERNAME/
        );
      } finally {
        if (platform !== undefined) Object.defineProperty(process, "platform", platform);
        if (username !== undefined) process.env.USERNAME = username;
      }
    });

    it("passes a path carrying shell metacharacters as one verbatim argument", async () => {
      // No `"`: the file is really written to disk, and that is illegal on NTFS. `&`, the
      // space, `;` and `$` are legal there and still split under a real shell.
      userDir = join(tempDir, "a & echo pwned; $HOME & b");
      vi.mocked(execFileSync).mockClear();

      await asWin32(() => storage.save({ method: "stored", token: "ghp_win" }, "user"));

      const args = vi.mocked(execFileSync).mock.calls[0]?.[1];
      expect(args?.[0]).toBe(userFile());
    });

    it("written file can be read back", async () => {
      await storage.save({ method: "stored", token: "ghp_roundtrip" }, "user");
      const result = await storage.read("user");
      expect(result).toMatchObject({ method: "stored", token: "ghp_roundtrip" });
    });
  });

  describe("delete", () => {
    it("removes an existing file", async () => {
      await writeFile(userFile(), "{}");
      await storage.delete("user");
      await expect(readFile(userFile())).rejects.toThrow();
    });

    it("does not throw when file does not exist", async () => {
      await expect(storage.delete("user")).resolves.not.toThrow();
    });
  });

  describe("paths", () => {
    it("keeps the project record at .aidd/auth.json under the project root", async () => {
      await storage.save(stored, "project");
      expect(await readFile(join(tempDir, ".aidd", "auth.json"), "utf-8")).toContain("ghp_secret");
    });

    it("writes the user record under the directory it was given", async () => {
      userDir = join(tempDir, "given");

      await storage.save({ method: "stored", token: "ghp_test" }, "user");

      expect(await readFile(join(tempDir, "given", "auth.json"), "utf-8")).toContain("ghp_test");
    });
  });

  describe("save", () => {
    it("saves project-level credential to .aidd/auth.json", async () => {
      await storage.save({ method: "stored", token: "ghp_save_project" }, "project");

      const saved = await storage.read("project");
      expect(saved?.token).toBe("ghp_save_project");
      expect(saved?.level).toBe("project");
    });

    it("saves user-level credential to user config path", async () => {
      await storage.save({ method: "stored", token: "ghp_save_user" }, "user");

      const saved = await storage.read("user");
      expect(saved?.token).toBe("ghp_save_user");
      expect(saved?.level).toBe("user");
    });

    it("saves external credential without token field", async () => {
      await storage.save({ method: "external", provider: "gh" }, "project");

      const saved = await storage.read("project");
      expect(saved?.method).toBe("external");
      expect("token" in (saved ?? {})).toBe(false);
    });
  });
});

describe("CredentialRecordFileAdapter, the record of each level", () => {
  let root: string;
  let project: string;
  let userDir: string;
  let records: CredentialRecordFileAdapter;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-auth-levels-"));
    project = join(root, "project");
    userDir = join(root, "user");
    records = new CredentialRecordFileAdapter(
      project,
      () => userDir,
      () => new Date(0)
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads no record at a level nothing was saved to", async () => {
    expect(await records.read("project")).toBeNull();
    expect(await records.read("user")).toBeNull();
  });

  it("keeps the project record under the project root and the user one in the user directory", async () => {
    await records.save({ method: "stored", token: "ghp_project" }, "project");
    await records.save({ method: "external", provider: "gh" }, "user");

    expect(JSON.parse(await readFile(join(project, ".aidd", "auth.json"), "utf-8"))).toMatchObject({
      level: "project",
      token: "ghp_project",
    });
    expect(JSON.parse(await readFile(join(userDir, "auth.json"), "utf-8"))).toMatchObject({
      level: "user",
      provider: "gh",
    });
  });

  it("reads back the record it saved, stamped by the clock it was given", async () => {
    await records.save({ method: "stored", token: "ghp_x" }, "user");

    expect(await records.read("user")).toStrictEqual({
      version: 1,
      method: "stored",
      level: "user",
      createdAt: "1970-01-01T00:00:00.000Z",
      token: "ghp_x",
    });
  });

  it("writes a saved record as these exact bytes", async () => {
    await records.save({ method: "stored", token: "ghp_x" }, "user");

    expect(await readFile(join(userDir, "auth.json"), "utf-8")).toBe(
      [
        "{",
        '  "version": 1,',
        '  "method": "stored",',
        '  "level": "user",',
        '  "createdAt": "1970-01-01T00:00:00.000Z",',
        '  "token": "ghp_x"',
        "}",
      ].join("\n")
    );
  });

  it("deletes the record of one level and leaves the other", async () => {
    await records.save({ method: "stored", token: "ghp_project" }, "project");
    await records.save({ method: "stored", token: "ghp_user" }, "user");

    await records.delete("project");

    expect(await records.read("project")).toBeNull();
    expect(await records.read("user")).not.toBeNull();
  });

  it("deletes a level that holds nothing without complaint", async () => {
    await expect(records.delete("user")).resolves.toBeUndefined();
  });
});
