const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { delimiter, join, resolve } = require("node:path");
const test = require("node:test");

const repo = resolve(__dirname, "../..");

function executable(path, body) {
  writeFileSync(path, `#!/bin/sh\nset -eu\n${body}\n`);
  chmodSync(path, 0o755);
}

/** On POSIX, nothing but the stubs and the platform's own utilities, so a real `opencode` or
 * `claude` installed on the machine running these tests can never answer in their place.
 * Windows has neither directory, and the utilities `dev-sync.sh` calls live wherever Git for
 * Windows put them, so there the inherited `PATH` is kept with the stubs merely first. */
const BASE_PATH =
  process.platform === "win32" ? (process.env.PATH ?? "") : ["/usr/bin", "/bin"].join(delimiter);

function runSync(fakeBin, home, args = ["all"]) {
  // `bash`, resolved on PATH, never the literal `/bin/bash`: that path does not exist on
  // Windows, where bash is the one Git for Windows ships. `spawnSync` resolves a bare name
  // through the platform's own rules on both.
  return spawnSync("bash", [join(repo, "scripts/dev-sync.sh"), ...args], {
    cwd: repo,
    env: {
      ...process.env,
      PATH: [fakeBin, BASE_PATH].join(delimiter),
      HOME: home,
      BUILD: join(home, "build"),
      OPENCODE_SKILLS: join(home, ".config/opencode/skills"),
    },
    encoding: "utf8",
  });
}

test("managed OpenCode reload uses the fixed-purpose helper without a local build", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-managed-"));
  try {
    const fakeBin = join(root, "bin");
    const home = join(root, "home");
    mkdirSync(fakeBin);
    mkdirSync(home);
    executable(join(fakeBin, "aidd-opencode-reload"), 'echo "managed:ok"');

    const result = runSync(fakeBin, home);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /reload opencode\s+managed:ok/);
    assert.equal(existsSync(join(home, "build")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const layout of ["flat", "nested"]) {
  test(`local OpenCode reload refreshes only the selected plugin using ${layout} output`, () => {
    const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-local-"));
    try {
      const fakeBin = join(root, "bin");
      const home = join(root, "home");
      mkdirSync(fakeBin);
      mkdirSync(home);
      mkdirSync(join(home, ".config/opencode/skills/aidd-dev-stale"), { recursive: true });
      writeFileSync(join(home, ".config/opencode/skills/aidd-dev-stale/SKILL.md"), "stale\n");
      mkdirSync(join(home, ".config/opencode/skills/aidd-dev/removed"), { recursive: true });
      writeFileSync(join(home, ".config/opencode/skills/aidd-dev/removed/SKILL.md"), "stale\n");
      mkdirSync(join(home, ".config/opencode/skills/aidd-dev/01-plan"), { recursive: true });
      writeFileSync(join(home, ".config/opencode/skills/aidd-dev/01-plan/SKILL.md"), "old\n");
      const unrelated = join(home, ".config/opencode/skills/aidd-pm/03-prd/SKILL.md");
      mkdirSync(join(home, ".config/opencode/skills/aidd-pm/03-prd"), { recursive: true });
      writeFileSync(unrelated, "keep\n");
      executable(join(fakeBin, "opencode"), "exit 0");
      const skillName = layout === "nested" ? "aidd-dev/01-plan" : "aidd-dev-01-plan";
      executable(
        join(fakeBin, "npx"),
        String.raw`out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out" ]; then shift; out=$1; fi
  shift
done
skill="$out/.opencode/skills/${skillName}"
mkdir -p "$skill/actions" "$skill/assets"
printf '%s\n' '---' 'name: aidd-dev-01-plan' 'description: test' '---' > "$skill/SKILL.md"
printf '%s\n' 'updated action' > "$skill/actions/04-plan.md"
printf '%s\n' 'updated template' > "$skill/assets/plan-template.md"`,
      );

      const result = runSync(fakeBin, home, ["aidd-dev"]);
      assert.equal(result.status, 0, result.stderr);
      const installed = join(home, ".config/opencode/skills", skillName);
      assert.match(readFileSync(join(installed, "SKILL.md"), "utf8"), /name: aidd-dev-01-plan/);
      assert.equal(readFileSync(join(installed, "actions/04-plan.md"), "utf8"), "updated action\n");
      assert.equal(readFileSync(join(installed, "assets/plan-template.md"), "utf8"), "updated template\n");
      assert.equal(existsSync(join(home, ".config/opencode/skills/aidd-dev-stale")), false);
      assert.equal(existsSync(join(home, ".config/opencode/skills/aidd-dev/removed")), false);
      assert.equal(readFileSync(unrelated, "utf8"), "keep\n");
      assert.match(result.stdout, /install opencode\s+skills:ok/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("local OpenCode reload rejects missing selected skills before removing installed ones", () => {
  const root = mkdtempSync(join(tmpdir(), "aidd-dev-sync-missing-"));
  try {
    const fakeBin = join(root, "bin");
    const home = join(root, "home");
    mkdirSync(fakeBin);
    const installed = join(home, ".config/opencode/skills/aidd-dev-01-plan/SKILL.md");
    mkdirSync(join(home, ".config/opencode/skills/aidd-dev-01-plan"), { recursive: true });
    writeFileSync(installed, "keep\n");
    executable(join(fakeBin, "opencode"), "exit 0");
    executable(join(fakeBin, "npx"), "exit 0");

    const result = runSync(fakeBin, home, ["aidd-dev"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no built OpenCode skills for aidd-dev/);
    assert.doesNotMatch(result.stdout, /skills:ok/);
    assert.equal(readFileSync(installed, "utf8"), "keep\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
