import { describe, expect, it } from "vitest";
import { resolveHomeDir } from "../../../src/shared/infrastructure/home-dir.js";

describe("resolving the home directory", () => {
  // `os.homedir()` reads `USERPROFILE` on Windows, never `HOME`, so a bare `homedir()` drops
  // a sandboxed `HOME`. No platform branch here, so a regression fails on every platform.
  it("prefers HOME over the OS-reported home directory", () => {
    const env: NodeJS.ProcessEnv = { HOME: "C:\\sandbox\\home" };
    const osHomedir = () => "C:\\Users\\runneradmin";

    expect(resolveHomeDir(env, osHomedir)).toBe("C:\\sandbox\\home");
  });

  it("falls back to the OS-reported home directory when HOME is unset", () => {
    const env: NodeJS.ProcessEnv = {};
    const osHomedir = () => "C:\\Users\\runneradmin";

    expect(resolveHomeDir(env, osHomedir)).toBe("C:\\Users\\runneradmin");
  });

  it("falls back when HOME is set but empty", () => {
    const env: NodeJS.ProcessEnv = { HOME: "" };
    const osHomedir = () => "C:\\Users\\runneradmin";

    expect(resolveHomeDir(env, osHomedir)).toBe("C:\\Users\\runneradmin");
  });
});
