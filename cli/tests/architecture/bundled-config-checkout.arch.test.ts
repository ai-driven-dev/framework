import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { environmentWithoutGitVariables } from "../../src/runtime/git/git-environment.js";
import { read } from "./helpers.js";

const ASSETS = [
  "assets/configs/opencode/opencode-events.js.txt",
  "assets/configs/codex/config.toml",
];

function changedByWindowsCheckout(attributes: string): string[] {
  const root = mkdtempSync(join(tmpdir(), "aidd-config-checkout-"));
  const env = { ...environmentWithoutGitVariables(), HOME: root, USERPROFILE: root };
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "core.autocrlf=true", ...args], {
      cwd: root,
      env,
      stdio: "pipe",
    });
  try {
    git("init", "--quiet");
    writeFileSync(join(root, ".gitattributes"), attributes);
    const expected = new Map(ASSETS.map((path) => [path, read(path).replace(/\r\n/g, "\n")]));
    for (const [path, content] of expected) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    git("add", "--", ".gitattributes", ...ASSETS);
    for (const path of ASSETS) rmSync(join(root, path));
    git("checkout-index", "--", ...ASSETS);
    return ASSETS.filter((path) => readFileSync(join(root, path), "utf8") !== expected.get(path));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("bundled config assets in a Windows checkout", () => {
  it("keeps the exact LF bytes that the bundle embeds", () => {
    expect(changedByWindowsCheckout(read(".gitattributes"))).toEqual([]);
  });

  it("detects changed bytes in both real assets when their LF rule is removed", () => {
    const withoutRule = read(".gitattributes")
      .split("\n")
      .filter((line) => !line.startsWith("assets/configs/"))
      .join("\n");
    expect(changedByWindowsCheckout(withoutRule)).toEqual(ASSETS);
  });
});
