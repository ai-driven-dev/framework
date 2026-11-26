import { describe, expect, it } from "vitest";
import { vscode } from "../../../src/composition/tool-profiles/vscode.js";

describe("vscode profile", () => {
  const declared = vscode.section("config");
  const settings = Array.isArray(declared) ? declared : [declared];
  const consuming = (name: string) => settings.find((s) => s.consumes(name));

  it.each([
    ["vscodeExtensions", ".vscode/extensions.json", "user-prime"],
    ["vscodeKeybindings", ".vscode/keybindings.json", "none"],
    ["vscodeSettings", ".vscode/settings.json", "user-prime"],
  ])("writes %s to %s and merges it as %s", (name, path, strategy) => {
    expect(consuming(name)?.fileOf("{}")).toMatchObject({
      relativePath: path,
      mergeStrategy: strategy,
    });
  });

  it("writes no file for a config name it does not know", () => {
    expect(consuming("unknown")).toBeUndefined();
  });
});
