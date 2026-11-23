import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveHomePath } from "../../../../src/contexts/tools/contract/home-path.js";

const HOME = join("/users", "ada");
const noEnvironment = (): undefined => undefined;

describe("a path under the home directory, declared as data", () => {
  it("joins each segment of a template under the home directory", () => {
    expect(resolveHomePath("{home}/.claude/plugins/cache", HOME, noEnvironment)).toBe(
      join(HOME, ".claude", "plugins", "cache")
    );
  });

  it("reads the directory an environment variable names before its fallback", () => {
    const path = {
      env: "CLAUDE_CONFIG_DIR",
      fallback: "{home}/.claude",
      fileName: "settings.json",
    };
    const set = (name: string) => (name === "CLAUDE_CONFIG_DIR" ? "/etc/claude" : undefined);
    expect(resolveHomePath(path, HOME, set)).toBe(join("/etc/claude", "settings.json"));
  });

  it("falls back when the variable is unset or empty", () => {
    const path = { env: "CODEX_HOME", fallback: "{home}/.codex", fileName: "config.toml" };
    const expected = join(HOME, ".codex", "config.toml");
    expect(resolveHomePath(path, HOME, noEnvironment)).toBe(expected);
    expect(resolveHomePath(path, HOME, () => "")).toBe(expected);
  });
});
