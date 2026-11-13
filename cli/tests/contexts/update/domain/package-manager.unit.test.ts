import { describe, expect, it } from "vitest";
import {
  INSTALL_COMMANDS,
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
