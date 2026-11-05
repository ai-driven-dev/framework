const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const LIBRARY = path.resolve(__dirname, "../../plugins/aidd-context/hooks/lib/common-rules.cjs");
const { deadPaths, isShellWrite, formatFindings } = require(LIBRARY);

/** A throwaway project holding `files`, removed after `body` runs. */
function inProject(files, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "common-rules-"));
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

test("the library exports exactly its three functions", () => {
  assert.deepEqual(Object.keys(require(LIBRARY)).sort(), ["deadPaths", "formatFindings", "isShellWrite"]);
});

test("the library requires only node:fs and node:path", () => {
  const required = [...fs.readFileSync(LIBRARY, "utf8").matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
  assert.deepEqual(required.sort(), ["node:fs", "node:path"]);
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

test("deadPaths: .git is never an anchor", () => {
  inProject({ ".git/HEAD": "" }, (root) => {
    assert.deepEqual(deadPaths("`.git/gone.txt`\n", root), []);
  });
});

// isShellWrite

const WRITES = [
  "echo x 1>f",
  "echo x &>f",
  "echo x >>f",
  "echo x >f",
  "echo x > f",
  "ls 2> err.txt",
  "echo x | tee f",
  "sed -i 's/a/b/' f",
  "sed -i.bak s/a/b/ f",
  "sed -E -i s/a/b/ f",
  "mv a b",
  "cp a b",
  "rm f",
  "touch f",
  "mkdir -p d",
  "patch -p1 < x.diff",
  "apply_patch",
  "git apply x.diff",
  "git checkout -- f",
  "git restore f",
  "cd d && rm f",
  "find . -name x -exec rm {} ;",
];

const READS = [
  "ls 2>&1",
  "ls >/dev/null",
  "ls 2>/dev/null",
  "cat f",
  "grep x f",
  "sed -n 1p f",
  "ls > /dev/null 2>&1",
  "ls &>/dev/null",
  "echo x >&2",
  "echo x 1>&2",
  "npm run format",
  "mvn test",
  "scp a b",
  "docker run --rm x",
  "cat aidd_docs/ui/rm.md",
  "ls aidd_docs/ui/cp/",
  "git status",
  "git log --oneline",
  "echo x >> /dev/null",
];

test("isShellWrite: every write form of the contract matches", () => {
  for (const command of WRITES) assert.equal(isShellWrite(command), true, command);
});

test("isShellWrite: reads, fd duplications and redirections to /dev/null do not match", () => {
  for (const command of READS) assert.equal(isShellWrite(command), false, command);
});

test("isShellWrite: rmdir does not match, because it is not a contract form and rm must not fire inside a word", () => {
  assert.equal(isShellWrite("rmdir d"), false);
});

test("isShellWrite: quoted text is blanked, the quotes themselves are kept", () => {
  for (const command of ['git commit -m "rm it"', 'grep ">" f', 'echo "a; rm b"', "cat 'a > b'", 'git log --grep "restore"', "echo 'sed -i x'"]) {
    assert.equal(isShellWrite(command), false, command);
  }
  for (const command of ['echo x > "f"', "echo x >'f'", 'echo "a" > f', `echo "it's" && rm f`]) {
    assert.equal(isShellWrite(command), true, command);
  }
});

test("isShellWrite: a command word counts only at command position", () => {
  for (const command of ["npm version patch", "echo rm", "grep -n mkdir f", "man tee", "echo sed -i", "echo git restore"]) {
    assert.equal(isShellWrite(command), false, command);
  }
  const atPosition = [
    "a; rm f",
    "a || rm f",
    "a | tee f",
    "$(rm f)",
    "`rm f`",
    "exec mv a b",
    "ls | xargs rm",
    "ls | xargs -0 rm",
    "sudo rm f",
    "env A=1 rm f",
    "env A=1 B=2 touch f",
    "find . -exec mv {} d ;",
    "cd d && sed -i s/a/b/ f",
    "sudo sed -i s/a/b/ f",
    "cd d && git restore f",
    "a; git -C d checkout f",
  ];
  for (const command of atPosition) assert.equal(isShellWrite(command), true, command);
});

test("isShellWrite: a path before a command word resolves by its basename", () => {
  for (const command of ["/bin/rm f", "./node_modules/.bin/tee f", "cd d && /usr/bin/mkdir x", "/usr/bin/git apply x.diff"]) {
    assert.equal(isShellWrite(command), true, command);
  }
  assert.equal(isShellWrite("/bin/rmdir d"), false);
});

test("isShellWrite: a redirection to a file beside /dev/null still matches", () => {
  assert.equal(isShellWrite("ls >/dev/null 2>err.txt"), true);
  assert.equal(isShellWrite("ls >/dev/nullx"), true);
});

test("isShellWrite: anything that is not a string is not a write", () => {
  for (const value of [undefined, null, 1, {}, ""]) assert.equal(isShellWrite(value), false, String(value));
});

// formatFindings

test("formatFindings: nothing to report prints nothing", () => {
  assert.equal(formatFindings("aidd-x", { errors: [], reached: [], warnings: [] }), "");
  assert.equal(formatFindings("aidd-x", {}), "");
});

test("formatFindings: errors, grouped reached errors and warnings, in the contract's order", () => {
  const output = formatFindings("aidd-context", {
    errors: [
      { file: "aidd_docs/memory/vcs.md", line: 4, rule: "M3", excerpt: "{{x}}", fix: "fill it or remove it" },
      { file: "aidd_docs/memory/kpi/x.md", rule: "layout", fix: "move it under internal/" },
    ],
    reached: [
      { file: "aidd_docs/ui/a.md", rule: "U1", excerpt: "first", fix: "rename it" },
      { file: "aidd_docs/ui/b.md", rule: "U1", excerpt: "second", fix: "rename it" },
      { file: "aidd_docs/ui/c.md", line: 2, rule: "U2", fix: "add a token" },
    ],
    warnings: [{ file: "aidd_docs/memory/cli.md", line: 7, rule: "M5", message: "cell of 36 words", fix: "split it" }],
  });
  assert.equal(
    output,
    [
      "aidd-context: 5 errors, 1 warnings",
      'aidd_docs/memory/vcs.md:4 M3 "{{x}}" => fill it or remove it',
      "aidd_docs/memory/kpi/x.md layout => move it under internal/",
      'U1 ×2 in aidd_docs/ui/* "first" => rename it',
      "aidd_docs/ui/c.md:2 U2 => add a token",
      "aidd_docs/memory/cli.md:7 M5 warning cell of 36 words => split it",
    ].join("\n")
  );
});

test("formatFindings: a group of one prints the plain line, never ×1", () => {
  const output = formatFindings("p", { reached: [{ file: "d/a.md", line: 3, rule: "R", excerpt: "e", fix: "f" }] });
  assert.equal(output, 'p: 1 errors, 0 warnings\nd/a.md:3 R "e" => f');
  assert.doesNotMatch(output, /×1/u);
});

test("formatFindings: reached errors group by rule, fix and folder, never across one of them", () => {
  const output = formatFindings("p", {
    reached: [
      { file: "d/a.md", rule: "R", fix: "f" },
      { file: "e/a.md", rule: "R", fix: "f" },
      { file: "d/b.md", rule: "R", fix: "g" },
      { file: "d/c.md", rule: "S", fix: "f" },
      { file: "d/d.md", rule: "R", fix: "f" },
    ],
  });
  assert.equal(output, ["p: 5 errors, 0 warnings", "R ×2 in d/* => f", "e/a.md R => f", "d/b.md R => g", "d/c.md S => f"].join("\n"));
});

test("formatFindings: the group folder uses forward slashes whatever the separator given", () => {
  const output = formatFindings("p", { reached: [{ file: "d\\x\\a.md", rule: "R", fix: "f" }, { file: "d\\x\\b.md", rule: "R", fix: "f" }] });
  assert.match(output, /^R ×2 in d\/x\/\* => f$/mu);
});

test("formatFindings: warnings stop at the cap, ten by default, and the count names them all", () => {
  const warnings = Array.from({ length: 12 }, (_, index) => ({ file: "a.md", line: index + 1, rule: "W", message: "m", fix: "f" }));
  const lines = formatFindings("p", { warnings }).split("\n");
  assert.equal(lines[0], "p: 0 errors, 12 warnings");
  assert.equal(lines.length, 11);
  assert.equal(formatFindings("p", { warnings }, { warningsCap: 3 }).split("\n").length, 4);
});

test("formatFindings: errors are never capped", () => {
  const errors = Array.from({ length: 25 }, (_, index) => ({ file: "a.md", line: index + 1, rule: "E", fix: "f" }));
  assert.equal(formatFindings("p", { errors }).split("\n").length, 26);
});

test("formatFindings: the output never asks for a rerun", () => {
  const output = formatFindings("p", {
    errors: [{ file: "a.md", rule: "E", fix: "f" }],
    warnings: Array.from({ length: 20 }, () => ({ file: "a.md", rule: "W", message: "m", fix: "f" })),
  });
  assert.doesNotMatch(output, /rerun/iu);
});
