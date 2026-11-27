import { afterEach, describe, expect, it, vi } from "vitest";
import { homeDirOf, homeDirResolver } from "../../src/composition/user-config-dir.js";

// The operating system reports a home other than the one HOME names, as a Windows session does.
vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  homedir: () => "C:\\Users\\runneradmin",
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolving the home directory", () => {
  // `os.homedir()` reads `USERPROFILE` on Windows, never `HOME`, so a bare `homedir()` drops
  // a sandboxed `HOME`. No platform branch here, so a regression fails on every platform.
  it("prefers HOME over the OS-reported home directory", () => {
    expect(homeDirOf({ HOME: "C:\\sandbox\\home" }, "C:\\Users\\runneradmin")).toBe(
      "C:\\sandbox\\home"
    );
  });

  it("falls back to the OS-reported home directory when HOME is unset", () => {
    expect(homeDirOf({}, "C:\\Users\\runneradmin")).toBe("C:\\Users\\runneradmin");
  });

  it("falls back when HOME is set but empty", () => {
    expect(homeDirOf({ HOME: "" }, "C:\\Users\\runneradmin")).toBe("C:\\Users\\runneradmin");
  });

  it("reads the environment once, whatever HOME becomes after", () => {
    vi.stubEnv("HOME", "/sandbox/home");
    const resolve = homeDirResolver();
    vi.stubEnv("HOME", "/elsewhere");

    expect(resolve()).toBe("/sandbox/home");
  });
});
