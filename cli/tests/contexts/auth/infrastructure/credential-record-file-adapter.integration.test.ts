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

/**
 * `process.platform` is a plain value property, so it is redefined rather than spied on; the
 * win32 branch alone shells out, and it needs `USERNAME`, which no POSIX session has.
 */
async function asWin32<T>(run: () => Promise<T>, account: string | null = "tester"): Promise<T> {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  const username = process.env.USERNAME;
  Object.defineProperty(process, "platform", { value: "win32", configurable: true });
  if (account === null) delete process.env.USERNAME;
  else process.env.USERNAME = account;
  try {
    return await run();
  } finally {
    if (platform !== undefined) Object.defineProperty(process, "platform", platform);
    if (username === undefined) delete process.env.USERNAME;
    else process.env.USERNAME = username;
  }
}

const STORED = { method: "stored", token: "ghp_x" } as const;

describe("CredentialRecordFileAdapter", () => {
  let root: string;
  let userDir: string;
  let records: CredentialRecordFileAdapter;
  const projectFile = (): string => join(root, "project", ".aidd", "auth.json");
  const userFile = (): string => join(userDir, "auth.json");

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-auth-file-"));
    userDir = join(root, "user");
    records = new CredentialRecordFileAdapter(
      join(root, "project"),
      () => userDir,
      () => new Date(0)
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe("where the records live", () => {
    it("keeps the project record under the project root and the user one in the user directory", async () => {
      await records.save(STORED, "project");
      await records.save({ method: "external", provider: "gh" }, "user");

      expect(JSON.parse(await readFile(projectFile(), "utf-8"))).toMatchObject({
        level: "project",
      });
      expect(JSON.parse(await readFile(userFile(), "utf-8"))).toMatchObject({ level: "user" });
    });
  });

  describe("reading a file", () => {
    it("reads a file that is not JSON as no record", async () => {
      await records.save(STORED, "user");
      await writeFile(userFile(), "not json");

      expect(await records.read("user")).toBeNull();
    });

    it("reads a file the record parse refuses as no record", async () => {
      await records.save(STORED, "user");
      await writeFile(userFile(), JSON.stringify({ version: 1 }));

      expect(await records.read("user")).toBeNull();
    });
  });

  describe("writing a record", () => {
    it.each([
      [
        "stored",
        STORED,
        [
          '  "method": "stored",',
          '  "level": "user",',
          '  "createdAt": "1970-01-01T00:00:00.000Z",',
          '  "token": "ghp_x"',
        ],
      ],
      [
        "external",
        { method: "external", provider: "gh" } as const,
        [
          '  "method": "external",',
          '  "level": "user",',
          '  "createdAt": "1970-01-01T00:00:00.000Z",',
          '  "provider": "gh"',
        ],
      ],
    ])(
      "writes the %s record as these exact bytes, stamped by the clock it was given",
      async (_method, credential, lines) => {
        await records.save(credential, "user");

        expect(await readFile(userFile(), "utf-8")).toBe(
          ["{", '  "version": 1,', ...lines, "}"].join("\n")
        );
      }
    );
  });

  describe.skipIf(process.platform === "win32")("on POSIX", () => {
    it("restricts an existing world-readable file to its owner when it rewrites it", async () => {
      await records.save(STORED, "user");
      await chmod(userFile(), 0o644);

      await records.save(STORED, "user");

      expect((await stat(userFile())).mode & 0o777).toBe(0o600);
    });
  });

  describe("on win32", () => {
    beforeEach(() => {
      vi.mocked(execFileSync).mockClear();
    });

    it("restricts the file through an icacls argument list, never a shell command line", async () => {
      await asWin32(() => records.save(STORED, "user"));

      expect(execFileSync).toHaveBeenCalledTimes(1);
      const [command, args] = vi.mocked(execFileSync).mock.calls[0] ?? [];
      expect(command).toBe("icacls");
      expect(args).toStrictEqual([userFile(), "/inheritance:r", "/grant:r", "tester:(R,W)"]);
    });

    it("names the account from the environment, not the %USERNAME% only a shell would expand", async () => {
      await asWin32(() => records.save(STORED, "user"), "Ada Lovelace");

      expect(vi.mocked(execFileSync).mock.calls[0]?.[1]).toContain("Ada Lovelace:(R,W)");
    });

    it.each([
      ["empty", ""],
      ["unset", null],
    ])(
      "refuses to leave inheritance stripped with no grant when the account is %s",
      async (_state, account) => {
        await expect(asWin32(() => records.save(STORED, "user"), account)).rejects.toThrow(
          `Failed to set restrictive permissions on ${userFile()}: USERNAME is not set, so no account can be granted access`
        );
      }
    );

    it("passes a path carrying shell metacharacters as one verbatim argument", async () => {
      // No `"`: the file is really written to disk, and that is illegal on NTFS. `&`, the
      // space, `;` and `$` are legal there and still split under a real shell.
      userDir = join(root, "a & echo pwned; $HOME & b");

      await asWin32(() => records.save(STORED, "user"));

      expect(vi.mocked(execFileSync).mock.calls[0]?.[1]?.[0]).toBe(userFile());
    });
  });
});
