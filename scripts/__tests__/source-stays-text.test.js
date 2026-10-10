const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it } = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const GIT_ENV = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

/**
 * A source file must stay readable by the tools people actually use on it. A raw NUL byte -
 * a sound separator for a composite key - makes `file` report `data` and every `grep` over
 * that file return nothing at all: no output, exit 1, indistinguishable from a genuine
 * absence, which is how a reviewer concludes a symbol is missing from the file defining it.
 *
 * The `\u0000` escape compiles to the identical string, so only searchability changes.
 */
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".cjs",
  ".mjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
]);

function workingTreeTextFiles(root = ROOT) {
  const listed = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    env: GIT_ENV,
    encoding: "buffer",
  });
  return listed
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((rel) => TEXT_EXTENSIONS.has(path.extname(rel)))
    .filter((rel) => fs.existsSync(path.join(root, rel)));
}

describe("every source file in the working tree stays greppable", () => {
  it("checks new files without trying to read deleted paths during a rename", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-source-stays-text-"));
    try {
      execFileSync("git", ["init", "--quiet"], { cwd: fixture, env: GIT_ENV });
      fs.writeFileSync(path.join(fixture, "unchanged.md"), "# Existing source\n");
      fs.writeFileSync(path.join(fixture, "old-name.md"), "# Renamed source\n");
      execFileSync("git", ["add", "unchanged.md", "old-name.md"], { cwd: fixture, env: GIT_ENV });
      fs.renameSync(path.join(fixture, "old-name.md"), path.join(fixture, "new-name.md"));
      fs.writeFileSync(path.join(fixture, ".gitignore"), "ignored.md\n");
      fs.writeFileSync(path.join(fixture, "ignored.md"), "# Ignored file\n");

      assert.deepEqual(workingTreeTextFiles(fixture).sort(), ["new-name.md", "unchanged.md"]);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("carries no raw NUL byte, so no search over it can fail in silence", () => {
    const files = workingTreeTextFiles();

    // A walk that found nothing would pass this test while checking nothing at all.
    assert.ok(files.length > 500, `expected the repository's source files, found ${files.length}`);

    const offenders = [];
    for (const rel of files) {
      const bytes = fs.readFileSync(path.join(ROOT, rel));
      if (bytes.includes(0)) {
        const line = bytes.subarray(0, bytes.indexOf(0)).toString("utf8").split("\n").length;
        offenders.push(`${rel}:${line}`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `raw NUL bytes make a file binary to grep and diff; write the \u0000 escape instead:\n  ${offenders.join("\n  ")}`
    );
  });
});
