const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const LIBRARY = path.resolve(__dirname, "../../plugins/aidd-context/hooks/lib/markdown.cjs");
const { deadPaths, markdownLines, proseLines } = require(LIBRARY);

/** A throwaway project holding `files`, removed after `body` runs. */
function inProject(files, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "markdown-"));
  try {
    for (const [name, text] of Object.entries(files)) {
      const full = path.join(root, name);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, text);
    }
    return body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("the markdown reader exports exactly its functions: the structure, the prose and the paths", () => {
  assert.deepEqual(Object.keys(require(LIBRARY)).sort(), ["deadPaths", "markdownLines", "namesIn", "proseLines"]);
});

test("the markdown reader requires only the built-ins the hook contract allows: node:fs, node:path", () => {
  const required = [...fs.readFileSync(LIBRARY, "utf8").matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
  for (const name of required) assert.ok(["node:fs", "node:path"].includes(name), `requires ${name}`);
});

// deadPaths

test("deadPaths: a backticked file under a real top-level folder that is missing is reported with its 1-based line", () => {
  inProject({ "src/here.cfg": "" }, (root) => {
    assert.deepEqual(deadPaths("# T\n\nSee `src/gone.cfg` and `src/here.cfg`.\n", root), [{ line: 3, path: "src/gone.cfg" }]);
  });
});

test("deadPaths: an unknown head, a directory, a glob, a version, a command and a local file stay quiet", () => {
  inProject({ "src/here.cfg": "" }, (root) => {
    const text = "`nowhere/x.cfg` `src/dir` `src/*.cfg` `>=22.12` `a b.cfg` `src/settings.local.json` `=x.y`\n";
    assert.deepEqual(deadPaths(text, root), []);
  });
});

test("deadPaths: a path inside a code fence or an HTML comment is not read", () => {
  inProject({ "src/here.cfg": "" }, (root) => {
    const text = "```\n`src/gone.cfg`\n```\n<!--\n`src/gone.cfg`\n-->\n<!-- `src/gone.cfg` -->\n`src/gone.cfg`\n";
    assert.deepEqual(deadPaths(text, root), [{ line: 8, path: "src/gone.cfg" }]);
  });
});

test("deadPaths: a ~~~ fence is a fence", () => {
  inProject({ "src/here.cfg": "" }, (root) => {
    assert.deepEqual(deadPaths("~~~\n`src/gone.cfg`\n~~~\n`src/gone.cfg`\n", root), [{ line: 4, path: "src/gone.cfg" }]);
  });
});

test("deadPaths: CRLF text keeps its line numbers and its fences", () => {
  inProject({ "src/here.cfg": "" }, (root) => {
    assert.deepEqual(deadPaths("# T\r\n```\r\n`src/gone.cfg`\r\n```\r\n`src/gone.cfg`\r\n", root), [{ line: 5, path: "src/gone.cfg" }]);
  });
});

test("deadPaths: a line number, a line range or an anchor after the path is not part of it", () => {
  inProject({ "src/here.cfg": "" }, (root) => {
    assert.deepEqual(deadPaths("`src/here.cfg:42` `src/here.cfg:4-9` `src/here.cfg#part`\n", root), []);
    assert.deepEqual(deadPaths("`src/gone.cfg:42`\n", root), [{ line: 1, path: "src/gone.cfg:42" }]);
  });
});

test("deadPaths: a line and a column after the path are not part of it", () => {
  inProject({ "src/here.cfg": "" }, (root) => {
    assert.deepEqual(deadPaths("`src/here.cfg:42:7`\n", root), []);
  });
});

test("deadPaths: a path that exists beside the citing file passes, one that exists nowhere is reported", () => {
  inProject({ "docs/other.md": "", "src/here.cfg": "", "Alpha.cfg": "", "docs/alpha.cfg": "" }, (root) => {
    const folder = path.join(root, "docs");
    assert.deepEqual(deadPaths("`alpha.cfg` `src/gone.cfg`\n", root, folder), [{ line: 1, path: "src/gone.cfg" }]);
    assert.deepEqual(deadPaths("`alpha.cfg`\n", root), [{ line: 1, path: "alpha.cfg" }]);
  });
});

test("deadPaths: a path climbing out with .. is never checked", () => {
  inProject({ "src/here.cfg": "" }, (root) => {
    assert.deepEqual(deadPaths("`src/../../gone.cfg` `src/../gone.cfg`\n", root), []);
  });
});

test("deadPaths: a folder linked outside the root is never followed", () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "markdown-outside-"));
  try {
    inProject({}, (root) => {
      fs.symlinkSync(outside, path.join(root, "linked"));
      assert.deepEqual(deadPaths("`linked/gone.cfg`\n", root), []);
    });
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

// A bank in a subproject names paths from its repository's root: such a path exists under the
// nearest ancestor holding a `.git` entry, a folder or a worktree's file alike.
test("deadPaths: a path missing under the root but present under the repository's root exists", () => {
  for (const gitEntry of [".git/HEAD", ".git"]) {
    inProject({ [gitEntry]: "", "tools/x.cfg": "", "pkg/tools/own.cfg": "" }, (repo) => {
      assert.deepEqual(deadPaths("`tools/x.cfg` `tools/gone.cfg`\n", path.join(repo, "pkg")), [{ line: 1, path: "tools/gone.cfg" }], gitEntry);
    });
  }
});

test("deadPaths: only the nearest ancestor holding .git counts as the repository's root", () => {
  inProject({ ".git/HEAD": "", "tools/x.cfg": "", "mid/.git": "", "mid/pkg/tools/own.cfg": "" }, (outer) => {
    assert.deepEqual(deadPaths("`tools/x.cfg`\n", path.join(outer, "mid/pkg")), [{ line: 1, path: "tools/x.cfg" }]);
  });
});

test("deadPaths: the repository's root keeps the containment rules: a link out of it is never followed", () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "markdown-outside-"));
  try {
    fs.writeFileSync(path.join(outside, "x.cjs"), "");
    inProject({ ".git/HEAD": "", "pkg/tools/own.cfg": "" }, (repo) => {
      fs.symlinkSync(outside, path.join(repo, "tools"));
      assert.deepEqual(deadPaths("`tools/x.cfg`\n", path.join(repo, "pkg")), [{ line: 1, path: "tools/x.cfg" }]);
    });
  } finally {
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

// A worktree's `.git` is a regular file and counts; a `.git` that is a link, dangling or not, is no repository.
test("deadPaths: a .git that is a link is not the repository's root", () => {
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "markdown-git-"));
  try {
    for (const target of [elsewhere, path.join(elsewhere, "gone")]) {
      inProject({ "tools/x.cfg": "", "pkg/tools/own.cfg": "" }, (repo) => {
        fs.symlinkSync(target, path.join(repo, ".git"));
        assert.deepEqual(deadPaths("`tools/x.cfg`\n", path.join(repo, "pkg")), [{ line: 1, path: "tools/x.cfg" }], target);
      });
    }
  } finally {
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
});

test("deadPaths: .git is never an anchor", () => {
  inProject({ ".git/HEAD": "" }, (root) => {
    assert.deepEqual(deadPaths("`.git/gone.txt`\n", root), []);
  });
});

// deadPaths: what is absent by design, and what is not a path

test("deadPaths: each segment is compared by its exact name, whatever the disk's case rule", () => {
  inProject({ "src/index.cfg": "", "pkg/.git/HEAD": "", "tools/Run.cfg": "" }, (root) => {
    assert.deepEqual(deadPaths("`src/Index.cfg` `src/index.cfg` `SRC/index.cfg`\n", root), [
      { line: 1, path: "src/Index.cfg" },
      { line: 1, path: "SRC/index.cfg" },
    ]);
    assert.deepEqual(deadPaths("`tools/run.cfg`\n", path.join(root, "pkg")), []);
  });
  inProject({ ".git/HEAD": "", "tools/Run.cfg": "", "pkg/tools/own.cfg": "" }, (repo) => {
    assert.deepEqual(deadPaths("`tools/run.cfg` `tools/Run.cfg`\n", path.join(repo, "pkg")), [{ line: 1, path: "tools/run.cfg" }]);
  });
});

test("deadPaths: a path under a folder a .gitignore ignores is absent by design, in the plain forms", () => {
  const files = { "cli/keep.cfg": "", "cli/.gitignore": "dist/\n*.gen.cfg\n/out\nnode_modules\n", "cli/dist/other.cfg": "" };
  inProject(files, (root) => {
    const text = "`cli/dist/cli.cfg` `cli/lib/x.gen.cfg` `cli/out/a.cfg` `cli/node_modules/pkg/i.cfg` `cli/src/gone.cfg`\n";
    assert.deepEqual(deadPaths(text, root), [{ line: 1, path: "cli/src/gone.cfg" }]);
  });
});

test("deadPaths: a .gitignore of the root, or of a parent folder up to the repository, ignores too", () => {
  inProject({ ".git/HEAD": "", ".gitignore": "gen/\n", "pkg/gen/other.cfg": "", "pkg/src/a.cfg": "" }, (repo) => {
    assert.deepEqual(deadPaths("`gen/out.cfg` `src/gone.cfg`\n", path.join(repo, "pkg")), [{ line: 1, path: "src/gone.cfg" }]);
  });
  inProject({ ".gitignore": "build\n", "build/other.cfg": "" }, (root) => {
    assert.deepEqual(deadPaths("`build/out.cfg`\n", root), []);
  });
});

test("deadPaths limit: an anchored pattern ignores only its own level, and a negation, ** or a slash inside are not read", () => {
  const files = { "cli/.gitignore": "/dist\n!keep.cfg\nlib/**/gen\nsrc/gen\n", "cli/a/dist/other.cfg": "", "cli/lib/x/gen/o.cfg": "", "cli/src/gen/o.cfg": "" };
  inProject(files, (root) => {
    const text = "`cli/a/dist/x.cfg` `cli/lib/x/gen/y.cfg` `cli/src/gen/y.cfg` `cli/dist/z.cfg`\n";
    assert.deepEqual(deadPaths(text, root).map(({ path: found }) => found), ["cli/a/dist/x.cfg", "cli/lib/x/gen/y.cfg", "cli/src/gen/y.cfg"]);
  });
});

test("deadPaths: a folder-only pattern ignores what is inside the folder, never a file of that name", () => {
  inProject({ "cli/.gitignore": "cache.json/\n", "cli/own.cfg": "" }, (root) => {
    assert.deepEqual(deadPaths("`cli/cache.json` `cli/cache.json/x.cfg`\n", root), [{ line: 1, path: "cli/cache.json" }]);
  });
});

test("deadPaths: a path cited from the repository's root is ignored by the .gitignore of that root's folders", () => {
  inProject({ ".git/HEAD": "", "cli/.gitignore": "dist/\n", "pkg/cli/own.cfg": "" }, (repo) => {
    assert.deepEqual(deadPaths("`cli/dist/x.cfg` `cli/src/gone.cfg`\n", path.join(repo, "pkg")), [{ line: 1, path: "cli/src/gone.cfg" }]);
  });
});

test("deadPaths: a path inside an uninitialised submodule is absent by design", () => {
  const modules = '[submodule "lib"]\n\tpath = vendor/lib\n\turl = https://example.test/lib.git\n';
  inProject({ ".gitmodules": modules, "vendor/lib/.keep": "" }, (root) => {
    fs.rmSync(path.join(root, "vendor/lib/.keep"));
    assert.deepEqual(deadPaths("`vendor/lib/thing.cfg` `vendor/own.cfg`\n", root), [{ line: 1, path: "vendor/own.cfg" }]);
  });
  inProject({ ".gitmodules": modules, "vendor/lib/other.cfg": "" }, (root) => {
    assert.deepEqual(deadPaths("`vendor/lib/thing.cfg`\n", root), [{ line: 1, path: "vendor/lib/thing.cfg" }], "a checked out submodule is read");
  });
});

test("deadPaths: a placeholder, a leading colon, a query and a line suffix are not part of the file", () => {
  inProject({ "src/index.cfg": "", "docs/guide.txt": "" }, (root) => {
    const text = "`src/{name}/x.txt` `src/:id.cfg` `src/<slug>.ts` `docs/guide.txt?plain=1` `src/index.cfg:L3` `src/index.cfg:L3-L9` `docs/guide.txt#top`\n";
    assert.deepEqual(deadPaths(text, root), []);
    assert.deepEqual(deadPaths("`docs/gone.txt?plain=1` `src/gone.cfg:L3`\n", root), [
      { line: 1, path: "docs/gone.txt?plain=1" },
      { line: 1, path: "src/gone.cfg:L3" },
    ]);
  });
});

test("deadPaths: every fence form, front matter and a comment opened mid-line hide their paths", () => {
  inProject({ "src/here.cfg": "" }, (root) => {
    const dead = "`src/gone.cfg`";
    const text = [
      "---",
      `files: ${dead}`,
      "---",
      "````md",
      "```",
      dead,
      "```",
      dead,
      "````",
      "~~~",
      "```",
      dead,
      "~~~",
      `> \`\`\``,
      `> ${dead}`,
      `> \`\`\``,
      "Intro.",
      "",
      `    ${dead}`,
      `Text <!-- start`,
      dead,
      "-->",
      dead,
    ].join("\n");
    assert.deepEqual(deadPaths(text, root), [{ line: 23, path: "src/gone.cfg" }]);
  });
});

// markdownLines: the one reader of structure

test("markdownLines: tells front matter, fences, comments, code and text apart", () => {
  const kinds = (text) => markdownLines(text).map(({ kind }) => kind);
  assert.deepEqual(kinds("---\na: b\n---\ntext\n"), ["front", "front", "front", "text", "text"]);
  assert.deepEqual(kinds("a\n````\n```\nb\n```\n````\nc\n"), ["text", "fence", "fence", "fence", "fence", "fence", "text", "text"]);
  assert.deepEqual(kinds("~~~\n```\n~~~\nx\n"), ["fence", "fence", "fence", "text", "text"]);
  assert.deepEqual(kinds("<!-- one -->\nx <!-- two --> y\n<!--\nz\n-->\n"), ["comment", "text", "comment", "comment", "comment", "text"]);
  assert.deepEqual(kinds("- item\n\n    not code\n"), ["text", "text", "text", "text"]);
  assert.deepEqual(kinds("text\n\n    code\n"), ["text", "text", "code", "text"]);
});

test("markdownLines: a comment opened inside a fence is fence text, and a fence inside a comment is comment text", () => {
  const kinds = (text) => markdownLines(text).map(({ kind }) => kind);
  assert.deepEqual(kinds("```\n<!--\n```\nx\n"), ["fence", "fence", "fence", "text", "text"]);
  assert.deepEqual(kinds("<!--\n```\n-->\nx\n"), ["comment", "comment", "comment", "text", "text"]);
});

test("markdownLines: a hard break is two trailing spaces or a backslash, and CRLF is read as LF", () => {
  const lines = markdownLines("a  \r\nb\\\r\nc\r\n");
  assert.deepEqual(lines.map(({ hardBreak, source }) => [hardBreak, source]), [[true, "a  "], [true, "b\\"], [false, "c"], [false, ""]]);
});

test("proseLines: only the lines of text, trimmed, without their comments", () => {
  assert.deepEqual(proseLines("# T\n\n```\nx\n```\n  y <!-- z --> w \n").map(({ number, text }) => [number, text]), [[1, "# T"], [6, "y  w"]]);
});
