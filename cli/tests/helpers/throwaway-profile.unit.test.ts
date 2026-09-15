import { homedir, tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { resolveAiddConfigDir, resolveHomeDir } from "../../src/kernel/reading/home-dir.js";
import { userConfigDir } from "../../src/runtime/user-config-dir.js";

describe("the profile a test run sees", () => {
  it("is a home under the temp directory, whichever route resolves it", () => {
    for (const resolved of [homedir(), resolveHomeDir(), resolveAiddConfigDir(), userConfigDir()]) {
      expect(resolved.startsWith(tmpdir()), resolved).toBe(true);
    }
  });

  it("carries no override that points outside that home", () => {
    for (const key of ["AIDD_USER_CONFIG_DIR", "AIDD_TELEMETRY_DIR", "XDG_CONFIG_HOME"]) {
      expect(process.env[key], key).toBeUndefined();
    }
  });
});
