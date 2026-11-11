import { describe, expect, it } from "vitest";
import { vscode } from "../../../../../../src/contexts/tools/domain/profiles/vscode/profile.js";

describe("vscode profile", () => {
  const declared = vscode.section("settings");
  const settings = Array.isArray(declared) ? declared : [declared];
  const consuming = (name: string) => settings.find((s) => s.consumes(name));

  it.each([
    ["vscodeExtensions", ".vscode/extensions.json", "user-prime"],
    ["vscodeKeybindings", ".vscode/keybindings.json", "none"],
    ["vscodeSettings", ".vscode/settings.json", "user-prime"],
  ])("writes %s to %s and merges it as %s", (name, path, strategy) => {
    expect(consuming(name)?.buildOutputPath()).toBe(path);
    expect(consuming(name)?.getMergeStrategy()).toBe(strategy);
  });

  it("writes no file for a config name it does not know", () => {
    expect(consuming("unknown")).toBeUndefined();
  });
});
