import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../src/runtime/wiring/tools.js";
import { assertMachineConfigDirectorySupported } from "../../src/runtime/machine-config-directory.js";

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "machine-config-"));
  vi.stubEnv("HOME", home);
  vi.stubEnv("XDG_CONFIG_HOME", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

describe("global tool configuration directory", () => {
  it("allows tools when XDG_CONFIG_HOME is unset", () => {
    expect(() => assertMachineConfigDirectorySupported(["kilo", "opencode"])).not.toThrow();
  });

  it("allows tools when XDG_CONFIG_HOME is the default directory", () => {
    vi.stubEnv("XDG_CONFIG_HOME", join(home, ".config"));
    expect(() => assertMachineConfigDirectorySupported(["kilo", "opencode"])).not.toThrow();
  });

  it.skipIf(process.platform === "win32")("accepts a symlink to the default directory", () => {
    const expected = join(home, ".config");
    const alias = join(home, "config-alias");
    mkdirSync(expected);
    symlinkSync(expected, alias);
    vi.stubEnv("XDG_CONFIG_HOME", alias);
    expect(() => assertMachineConfigDirectorySupported(["opencode"])).not.toThrow();
  });

  it.each(["kilo", "opencode"])("refuses %s when its host reads another config root", (tool) => {
    vi.stubEnv("XDG_CONFIG_HOME", join(home, "different"));
    expect(() => assertMachineConfigDirectorySupported([tool])).toThrow(
      `${tool} global installation requires XDG_CONFIG_HOME`
    );
  });

  it("reports both affected tools when checking every registered tool", () => {
    vi.stubEnv("XDG_CONFIG_HOME", join(home, "different"));
    expect(() => assertMachineConfigDirectorySupported()).toThrow(/kilo/);
    expect(() => assertMachineConfigDirectorySupported()).toThrow(/opencode/);
  });

  it("allows unrelated, unselected, and unrecognized tools with a custom XDG root", () => {
    vi.stubEnv("XDG_CONFIG_HOME", join(home, "different"));
    expect(() =>
      assertMachineConfigDirectorySupported(["claude", "codex", "cursor", "copilot"])
    ).not.toThrow();
    expect(() => assertMachineConfigDirectorySupported([])).not.toThrow();
    expect(() => assertMachineConfigDirectorySupported(["unknown"])).not.toThrow();
  });
});
