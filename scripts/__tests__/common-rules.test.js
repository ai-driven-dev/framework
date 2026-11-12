const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const LIBRARY = path.resolve(__dirname, "../../plugins/aidd-context/hooks/lib/common-rules.cjs");
const { isShellWrite, formatFindings } = require(LIBRARY);

test("the shared library exports exactly what every plugin's hooks call: the write test and the output shape", () => {
  assert.deepEqual(Object.keys(require(LIBRARY)).sort(), ["formatFindings", "isShellWrite"]);
});

test("the shared library requires only the built-in the hook contract allows: node:path", () => {
  const required = [...fs.readFileSync(LIBRARY, "utf8").matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
  for (const name of required) assert.ok(["node:path"].includes(name), `requires ${name}`);
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

test("isShellWrite: rmdir removes a folder of the watched tree, in bash and in PowerShell, so it is a write", () => {
  for (const command of ["rmdir d", "/bin/rmdir d", "Rmdir d", "a; rmdir d"]) assert.equal(isShellWrite(command), true, command);
});

test("isShellWrite: a subshell, a background job and sudo with its flags are command positions", () => {
  for (const command of ["( rm f )", "(rm f)", "a & rm f", "sudo -u x rm f", "sudo -E rm f", "ls | xargs -n 1 rm"]) {
    assert.equal(isShellWrite(command), true, command);
  }
});

test("isShellWrite: a quoted command word is read unquoted", () => {
  for (const command of ['"rm" f', "'mv' a b", 'a; "/bin/rm" f']) assert.equal(isShellWrite(command), true, command);
  assert.equal(isShellWrite('echo "rm"'), false);
});

test("isShellWrite: quoted text is never a command or a redirection", () => {
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
  assert.equal(isShellWrite("/bin/rmx d"), false, "rm never fires inside a longer word");
});

test("isShellWrite: a redirection to a file beside /dev/null still matches", () => {
  assert.equal(isShellWrite("ls >/dev/null 2>err.txt"), true);
  assert.equal(isShellWrite("ls >/dev/nullx"), true);
});

test("isShellWrite: sed --in-place and the git, perl and find write forms match", () => {
  const writes = [
    "sed --in-place s/a/b/ f",
    "git mv a b",
    "git rm f",
    "git stash",
    "git reset --hard",
    "perl -i -pe s/a/b/ f",
    "perl -pi -e s/a/b/ f",
    "find . -name x -delete",
  ];
  for (const command of writes) assert.equal(isShellWrite(command), true, command);
  for (const command of ["perl -ne print f", "find . -name x", "git show HEAD"]) assert.equal(isShellWrite(command), false, command);
});

test("isShellWrite: an assignment, a brace group, a negation, time, nohup and command open a command position", () => {
  for (const command of ["A=1 rm f", "A=1 B=2 rm f", "{ rm f; }", "! rm f", "time rm f", "nohup rm f", "command rm f"]) {
    assert.equal(isShellWrite(command), true, command);
  }
  assert.equal(isShellWrite('bash -c "rm f"'), false);
});

test("isShellWrite: a heredoc body is text, never a redirection or a command", () => {
  const body = "gh pr create --body-file - <<'EOF'\n- aidd_docs/ui/x.md => moved\n- rm the old one\nEOF";
  assert.equal(isShellWrite(body), false);
  assert.equal(isShellWrite("cat <<-EOF\n\tx > y\n\tEOF\nls"), false);
  assert.equal(isShellWrite("cat <<<EOF\nrm f\nEOF"), true, "a here-string opens no body");
  for (const command of ["cat > f <<EOF\nx\nEOF", "cat <<EOF > f\nx\nEOF", "cat <<EOF\nx\nEOF\nrm f", "cat <<EOF\r\nx\r\nEOF\r\nrm f"]) {
    assert.equal(isShellWrite(command), true, JSON.stringify(command));
  }
});

test("isShellWrite: git and perl subcommands that touch only the index, a branch or nothing are reads", () => {
  const reads = [
    "git reset",
    "git reset --soft HEAD~1",
    "git reset HEAD f",
    "git rm --cached f",
    "git stash list",
    "git stash show",
    "git restore --staged f",
    "git checkout -b x",
    "git checkout -B x",
    "perl -Mstrict -e 1",
    "perl -MFile::Find -e 1",
  ];
  for (const command of reads) assert.equal(isShellWrite(command), false, command);
  const writes = [
    "git reset --merge",
    "git reset --keep",
    "git stash push",
    "git stash pop",
    "git stash apply",
    "git stash drop",
    "git stash clear",
    "git restore --staged --worktree f",
    "git checkout -b x -- f",
    "perl -i.bak -pe 1 f",
    "perl -pi.bak -e 1 f",
  ];
  for (const command of writes) assert.equal(isShellWrite(command), true, command);
});

test("isShellWrite: a heredoc marker inside quotes or arithmetic opens no body", () => {
  assert.equal(isShellWrite('echo "a << b"\nrm f'), true);
  assert.equal(isShellWrite("echo $((1<<2))\nrm f"), true);
});

test("isShellWrite: <<- ends its body on a tab-indented marker", () => {
  assert.equal(isShellWrite("cat <<-EOF\n\tx\n\tEOF\nrm f"), true);
});

test("isShellWrite: then, do, else and elif open a command position", () => {
  for (const command of ["for f; do rm $f; done", "if x; then rm f; fi", "if x; then :; else rm f; fi", "if x; then :; elif rm f; then :; fi"]) {
    assert.equal(isShellWrite(command), true, command);
  }
});

test("isShellWrite: command -v and -V only look a command up", () => {
  for (const command of ["command -v rm", "command -V rm"]) assert.equal(isShellWrite(command), false, command);
});

test("isShellWrite: a PowerShell cmdlet or documented alias that writes matches, whatever its case", () => {
  const cmdlets = ["Set-Content", "Add-Content", "Out-File", "New-Item", "Remove-Item", "Move-Item", "Copy-Item", "Rename-Item", "Clear-Content"];
  const aliases = ["sc", "ac", "ni", "ri", "del", "erase", "rd", "mi", "move", "cpi", "copy", "rni", "ren", "clc"];
  for (const name of [...cmdlets, ...aliases]) assert.equal(isShellWrite(`${name} -Path f`), true, name);
  for (const command of ["remove-item f", "REMOVE-ITEM f", "Get-Item f; Remove-Item f", "& Remove-Item f"]) {
    assert.equal(isShellWrite(command), true, command);
  }
});

test("isShellWrite: a pipeline into Out-File, Set-Content or Add-Content matches", () => {
  for (const sink of ["Out-File f", "Set-Content f", "Add-Content -Path f"]) {
    assert.equal(isShellWrite(`Get-Content a | ${sink}`), true, sink);
  }
});

test("isShellWrite: PowerShell reads, and a redirection to $null, do not match", () => {
  const reads = [
    "Get-Content f",
    "Get-ChildItem aidd_docs",
    "Test-Path f",
    "Select-String -Pattern x -Path f",
    "Write-Output x",
    "Write-Host x",
    "Get-ChildItem 2>$null",
    "Get-ChildItem > $null",
    "Write-Output x | Out-Null",
  ];
  for (const command of reads) assert.equal(isShellWrite(command), false, command);
  assert.equal(isShellWrite("Get-ChildItem > $nullx"), true);
});

test("isShellWrite: 100 KB of nested prefixes, quotes and parentheses returns in under 100 ms", () => {
  const command = `${"sudo -u sudo ".repeat(7700)}${"(\"'".repeat(1000)}${"((".repeat(500)} ls`;
  assert.ok(command.length > 100_000);
  const start = performance.now();
  isShellWrite(command);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 100, `took ${Math.round(elapsed)} ms`);
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
      { file: "aidd_docs/ui/b.md", rule: "U1", excerpt: "first", fix: "rename it" },
      { file: "aidd_docs/ui/c.md", line: 2, rule: "U2", fix: "add a token" },
    ],
    warnings: [{ file: "aidd_docs/memory/cli.md", line: 7, rule: "M5", message: "cell of 36 words", fix: "split it" }],
  });
  assert.equal(
    output,
    [
      "aidd-context: 5 errors, 1 warning",
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
  assert.equal(output, 'p: 1 error, 0 warnings\nd/a.md:3 R "e" => f');
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

test("formatFindings: a group prints an excerpt only when every member shares it", () => {
  const mixed = formatFindings("p", {
    reached: [
      { file: "ui/a.md", rule: "C1", excerpt: "apps/web/src/ui/Button.tsx", fix: "create it" },
      { file: "ui/b.md", rule: "C1", excerpt: "apps/web/src/ui/Card.tsx", fix: "create it" },
    ],
  });
  assert.equal(mixed, "p: 2 errors, 0 warnings\nC1 ×2 in ui/* => create it");
  const partial = formatFindings("p", {
    reached: [
      { file: "ui/a.md", rule: "C4", excerpt: "#FF6B3514", fix: "use a token" },
      { file: "ui/b.md", rule: "C4", fix: "use a token" },
    ],
  });
  assert.equal(partial, "p: 2 errors, 0 warnings\nC4 ×2 in ui/* => use a token");
  const uniform = formatFindings("p", {
    reached: [
      { file: "ui/a.md", rule: "C4", excerpt: "#FF6B3514", fix: "use a token" },
      { file: "ui/b.md", rule: "C4", excerpt: "#FF6B3514", fix: "use a token" },
    ],
  });
  assert.equal(uniform, 'p: 2 errors, 0 warnings\nC4 ×2 in ui/* "#FF6B3514" => use a token');
});

test("formatFindings: a group within one file names that file", () => {
  const output = formatFindings("p", { reached: [{ file: "d/a.md", line: 1, rule: "R", fix: "f" }, { file: "d/a.md", line: 4, rule: "R", fix: "f" }] });
  assert.equal(output, "p: 2 errors, 0 warnings\nR ×2 in d/a.md => f");
});

test("formatFindings: a group of root-level files prints in *", () => {
  const output = formatFindings("p", { reached: [{ file: "a.md", rule: "R", fix: "f" }, { file: "b.md", rule: "R", fix: "f" }] });
  assert.equal(output, "p: 2 errors, 0 warnings\nR ×2 in * => f");
});

test("formatFindings: an excerpt stays on one line, its quotes escaped", () => {
  const output = formatFindings("p", { errors: [{ file: "a.md", line: 1, rule: "R", excerpt: 'say "hi"\nthen\r\ngo', fix: "f" }] });
  assert.equal(output, 'p: 1 error, 0 warnings\na.md:1 R "say \\"hi\\" then go" => f');
});

test("formatFindings: a backslash in an excerpt is escaped before its quotes", () => {
  const output = formatFindings("p", { errors: [{ file: "a.md", rule: "R", excerpt: 'C:\\x "y"', fix: "f" }] });
  assert.equal(output, 'p: 1 error, 0 warnings\na.md R "C:\\\\x \\"y\\"" => f');
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

test("formatFindings: one error and one warning are singular, any other count plural", () => {
  assert.equal(formatFindings("p", { errors: [{ file: "a.md", rule: "R", fix: "f" }], warnings: [{ file: "a.md", rule: "W", message: "m", fix: "f" }] }).split("\n")[0], "p: 1 error, 1 warning");
  assert.equal(formatFindings("p", { warnings: [{ file: "a.md", rule: "W", message: "m", fix: "f" }] }).split("\n")[0], "p: 0 errors, 1 warning");
  assert.equal(formatFindings("p", { errors: [{ file: "a.md", rule: "R", fix: "f" }, { file: "b.md", rule: "R", fix: "f" }] }).split("\n")[0], "p: 2 errors, 0 warnings");
});
