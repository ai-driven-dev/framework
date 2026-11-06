import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import { CLI_ROOT } from "./helpers.js";

it("preserves old user directories when Vitest starts", () => {
  const root = mkdtempSync(join(tmpdir(), "sweep-isolated-"));
  try {
    const profile = join(root, "profile");
    mkdirSync(profile);
    const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT;
    const names = [
      "aidd-my-worktree",
      "auth-storage-test-user",
      "marketplace-registry-user",
      "mkt-list-user",
      "trust-store-user",
    ];
    for (const name of names) {
      const dir = join(root, name);
      mkdirSync(dir);
      writeFileSync(join(dir, "user-file"), "keep");
      if (name === "aidd-my-worktree")
        writeFileSync(join(dir, ".git"), "gitdir: /example/worktree");
      const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
      utimesSync(dir, old, old);
    }
    execFileSync(
      process.execPath,
      [
        join(CLI_ROOT, "node_modules", "vitest", "vitest.mjs"),
        "run",
        "--project=unit",
        "tests/helpers/throwaway-profile.unit.test.ts",
      ],
      {
        cwd: CLI_ROOT,
        encoding: "utf8",
        env: {
          PATH: dirname(process.execPath),
          HOME: profile,
          USERPROFILE: profile,
          TMPDIR: root,
          TMP: root,
          TEMP: root,
          CI: "true",
          ...(systemRoot === undefined ? {} : { SystemRoot: systemRoot }),
        },
        timeout: 60000,
      }
    );
    for (const name of names)
      expect(readFileSync(join(root, name, "user-file"), "utf8")).toBe("keep");
    expect(readFileSync(join(root, "aidd-my-worktree", ".git"), "utf8")).toBe(
      "gitdir: /example/worktree"
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
