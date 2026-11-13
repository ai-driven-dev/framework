import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PackageManagerInstallerAdapter } from "../../../../src/contexts/update/infrastructure/package-manager-installer-adapter.js";
import {
  ElevatedPermissionUpdateError,
  PackageManagerDetectionError,
  UpdateError,
} from "../../../../src/kernel/errors.js";

vi.mock("node:child_process", () => ({ execSync: vi.fn() }));
const mockExecSync = vi.mocked(execSync);

const ENV = { PATH: "/stubs" };
let written: string[];
const realWrite = process.stderr.write;

beforeEach(() => {
  vi.clearAllMocks();
  written = [];
  process.stderr.write = ((chunk: string | Uint8Array) => {
    written.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
});

afterEach(() => {
  process.stderr.write = realWrite;
});

function failing(thrown: unknown) {
  mockExecSync.mockReturnValueOnce("/usr/local/bin/aidd").mockImplementationOnce(() => {
    throw thrown;
  });
}

describe("PackageManagerInstallerAdapter", () => {
  it.each([
    ["linux", "which aidd"],
    ["win32", "where aidd"],
  ] as const)(
    "looks the binary up with the command of %s, in the env it was given",
    (platform, lookup) => {
      mockExecSync.mockReturnValueOnce("/usr/local/bin/aidd\n").mockReturnValue(Buffer.alloc(0));

      new PackageManagerInstallerAdapter(ENV, platform).install();

      expect(mockExecSync.mock.calls[0]).toStrictEqual([lookup, { env: ENV, encoding: "utf8" }]);
    }
  );

  it("runs the install in that env with stderr piped, and answers the first binary found", () => {
    mockExecSync
      .mockReturnValueOnce("/usr/local/bin/aidd\r\n/opt/aidd\r\n")
      .mockReturnValue(Buffer.alloc(0));

    expect(new PackageManagerInstallerAdapter(ENV, "linux").install()).toBe("/usr/local/bin/aidd");
    expect(mockExecSync.mock.calls[1]).toStrictEqual([
      "npm install -g @ai-driven-dev/cli@latest",
      { env: ENV, stdio: ["inherit", "inherit", "pipe"] },
    ]);
  });

  it("refuses when the lookup finds nothing", () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error("not found");
    });

    expect(() => new PackageManagerInstallerAdapter(ENV, "win32").install()).toThrow(
      PackageManagerDetectionError
    );
  });

  it("echoes the failed install's stderr once, then refuses", () => {
    failing(Object.assign(new Error("failed"), { stderr: Buffer.from("npm error 403\n") }));

    expect(() => new PackageManagerInstallerAdapter(ENV, "linux").install()).toThrow(
      new UpdateError()
    );
    expect(written).toStrictEqual(["npm error 403\n"]);
  });

  it("asks for elevation when the stderr names a refused permission", () => {
    failing(Object.assign(new Error("failed"), { stderr: Buffer.from("npm error code EPERM") }));

    expect(() => new PackageManagerInstallerAdapter(ENV, "linux").install()).toThrow(
      ElevatedPermissionUpdateError
    );
  });

  it.each([
    ["no stderr", new Error("failed")],
    ["a failure that is no object", "failed"],
    ["a null failure", null],
    ["a stderr that is no bytes", Object.assign(new Error("failed"), { stderr: 42 })],
  ])("echoes nothing and refuses with the update error on %s", (_label, thrown) => {
    failing(thrown);

    expect(() => new PackageManagerInstallerAdapter(ENV, "linux").install()).toThrow(
      new UpdateError()
    );
    expect(written).toStrictEqual([]);
  });
});
