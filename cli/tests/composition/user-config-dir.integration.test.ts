import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { userConfigDir } from "../../src/composition/user-config-dir.js";

const ENV_KEYS = ["AIDD_USER_CONFIG_DIR", "XDG_CONFIG_HOME"] as const;

function saveEnv(): Record<(typeof ENV_KEYS)[number], string | undefined> {
  return {
    AIDD_USER_CONFIG_DIR: process.env.AIDD_USER_CONFIG_DIR,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
  };
}

function restoreEnv(saved: Record<(typeof ENV_KEYS)[number], string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

describe("locating the user config dir", () => {
  const saved = saveEnv();
  afterEach(() => restoreEnv(saved));

  it("honors XDG_CONFIG_HOME when AIDD_USER_CONFIG_DIR is unset", () => {
    delete process.env.AIDD_USER_CONFIG_DIR;
    process.env.XDG_CONFIG_HOME = "/xdg/config";

    expect(userConfigDir()).toBe(join("/xdg/config", "aidd"));
  });

  it("prefers AIDD_USER_CONFIG_DIR over XDG_CONFIG_HOME", () => {
    process.env.AIDD_USER_CONFIG_DIR = "/custom/aidd";
    process.env.XDG_CONFIG_HOME = "/xdg/config";

    expect(userConfigDir()).toBe("/custom/aidd");
  });

  it("falls back to ~/.config/aidd when neither is set", () => {
    delete process.env.AIDD_USER_CONFIG_DIR;
    delete process.env.XDG_CONFIG_HOME;

    expect(userConfigDir()).toBe(join(homedir(), ".config", "aidd"));
  });
});
