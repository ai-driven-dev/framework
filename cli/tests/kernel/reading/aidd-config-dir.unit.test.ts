import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAiddConfigDir, resolveHomeDir } from "../../../src/kernel/reading/home-dir.js";

describe("resolveAiddConfigDir", () => {
  it.skipIf(process.platform === "win32")(
    "sits under .config in the home directory on POSIX",
    () => {
      expect(resolveAiddConfigDir()).toBe(join(resolveHomeDir(), ".config", "aidd"));
    }
  );
});
