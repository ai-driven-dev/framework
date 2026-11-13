import { describe, expect, it } from "vitest";
import {
  firstBinaryPath,
  INSTALL_COMMANDS,
  isPermissionFailure,
  packageManagerOf,
} from "../../../../src/contexts/update/domain/package-manager.js";

describe("packageManagerOf", () => {
  it.each([
    ["/home/me/.local/share/pnpm/aidd", "pnpm"],
    ["/home/me/.yarn/bin/aidd", "yarn"],
    ["/home/me/.bun/bin/aidd", "bun"],
    ["/usr/local/bin/aidd", "npm"],
    ["C:\\Users\\me\\AppData\\Local\\pnpm\\aidd.cmd", "pnpm"],
    ["C:\\Users\\me\\AppData\\Local\\Yarn\\bin\\aidd.cmd", "yarn"],
    ["C:\\Users\\me\\.bun\\bin\\aidd.cmd", "bun"],
    ["C:\\Users\\me\\AppData\\Local\\Bun\\Bin\\aidd.exe", "bun"],
    ["C:\\Program Files\\nodejs\\aidd.cmd", "npm"],
  ])("reads %s as installed by %s", (path, manager) => {
    expect(packageManagerOf(path)).toBe(manager);
  });

  it("installs the latest release globally, whichever the manager", () => {
    expect(
      Object.values(INSTALL_COMMANDS).every((c) => c.endsWith("@ai-driven-dev/cli@latest"))
    ).toBe(true);
  });
});

describe("firstBinaryPath", () => {
  it.each([
    ["LF", "/usr/local/bin/aidd\n/opt/other/aidd\n"],
    ["CRLF", "/usr/local/bin/aidd\r\n/opt/other/aidd\r\n"],
  ])("keeps the first match of a listing separated by %s", (_label, listing) => {
    expect(firstBinaryPath(listing)).toBe("/usr/local/bin/aidd");
  });
});

describe("isPermissionFailure", () => {
  it.each([
    ["npm error code EPERM", true],
    ["npm error code EACCES", true],
    ["npm error 403", false],
    ["EPERMISSIVE", false],
  ])("answers %s with %s", (stderr, expected) => {
    expect(isPermissionFailure(stderr)).toBe(expected);
  });
});
