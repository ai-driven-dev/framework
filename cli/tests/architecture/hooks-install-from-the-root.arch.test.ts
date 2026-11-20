import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT } from "./helpers.js";

describe("git hooks are installed from the repository root only", () => {
  it("no script of this package calls lefthook: a hook in a worktree runs it with GIT_DIR set, and it takes cli/ for the root", () => {
    const { scripts } = JSON.parse(readFileSync(join(CLI_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(Object.entries(scripts).filter(([, command]) => /\blefthook\b/.test(command))).toEqual(
      []
    );
  });
});
