const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const yaml = require("js-yaml");

const root = path.resolve(__dirname, "../..");

const cliCiWorkflow = () =>
  yaml.load(fs.readFileSync(path.join(root, ".github/workflows/cli-ci.yml"), "utf8"));

// A pull request merges with `cli CI`'s real jobs red when no required check names one of
// them. `gate` fans every job in, so a job silently missing from its `needs` is that bug
// again: this reads the job list live off the workflow rather than duplicating it by hand.
test("cli-ci.yml's gate job needs every other job in the workflow", () => {
  const jobs = cliCiWorkflow().jobs;
  const everyOtherJob = Object.keys(jobs)
    .filter((name) => name !== "gate")
    .sort();
  const gateNeeds = [...jobs.gate.needs].sort();

  assert.deepEqual(gateNeeds, everyOtherJob);
});

test("gate reports even when a needed job fails or is skipped (if: always())", () => {
  assert.equal(cliCiWorkflow().jobs.gate.if, "always()");
});

// The ruleset JSON is the one GitHub actually enforces once an admin applies it
// (`docs/MAINTAINERS.md`); this only pins that the file names the right check.
test("both branch rulesets require the cli/gate check by its exact job name", () => {
  const gateName = cliCiWorkflow().jobs.gate.name;

  for (const rulesetFile of ["main.json", "next.json"]) {
    const ruleset = JSON.parse(
      fs.readFileSync(path.join(root, ".github/rulesets", rulesetFile), "utf8")
    );
    const statusCheckRule = ruleset.rules.find((rule) => rule.type === "required_status_checks");
    const contexts = statusCheckRule.parameters.required_status_checks.map((c) => c.context);

    assert.ok(
      contexts.includes(gateName),
      `${rulesetFile} does not require "${gateName}" in its required_status_checks`
    );
  }
});

// The filter decides whether the suite runs at all. A change to the workflow itself is a
// change nothing else in the filter matches, so unless the filter names its own file, the
// commit that changes how the suite runs is the one commit the suite never runs on.
test("the changes filter names the workflow file itself as relevant", () => {
  const changes = cliCiWorkflow().jobs.changes;
  const script = changes.steps.map((step) => step.run ?? "").join("\n");
  const ownPath = ".github/workflows/cli-ci.yml";

  assert.match(
    script,
    new RegExp(`^\\s*${ownPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`, "m"),
    `${ownPath} must be a case of the relevance filter, on its own line`
  );
});

test("only a proven next snapshot tree skips the promotion or main mutation matrix", () => {
  const workflow = cliCiWorkflow();
  const changes = workflow.jobs.changes;
  const promotion = changes.steps.find((step) => step.id === "promotion");
  const mutation = changes.steps.find((step) => step.id === "mutation");

  assert.equal(workflow.permissions.actions, "read");
  assert.equal(workflow.permissions.contents, "read");
  assert.equal(workflow.permissions["pull-requests"], undefined);
  assert.deepEqual(changes.permissions, {
    actions: "read",
    contents: "read",
    "pull-requests": "read",
  });
  assert.equal(changes.outputs.trusted_promotion, "${{ steps.promotion.outputs.trusted }}");
  assert.equal(promotion.name, "Check whether a promotion snapshot or main merge passed next");
  assert.match(promotion.run, /EVENT_NAME.*pull_request/);
  assert.match(promotion.run, /BASE_REF.*main/);
  assert.equal(promotion.env.HEAD_REPO, "${{ github.event.pull_request.head.repo.full_name }}");
  assert.match(promotion.run, /HEAD_REF.*\^promote\/next-to-main-\[0-9\]\+\$/);
  assert.match(promotion.run, /HEAD_REPO" == "\$REPO/);
  assert.match(promotion.run, /git merge-base --is-ancestor "\$BASE_SHA" "\$HEAD_SHA"/);
  assert.match(promotion.run, /git rev-parse "\$CURRENT_SHA\^\{tree\}"/);
  assert.match(promotion.run, /"\$merge_tree" != "\$snapshot_tree"/);
  assert.match(
    promotion.run,
    /actions\/workflows\/cli-ci\.yml\/runs\?branch=next&event=push&status=completed&head_sha=\$HEAD_SHA/
  );
  assert.match(promotion.run, /\.conclusion == "success"/);
  assert.match(promotion.run, /\.name == "cli \/ gate" and \.conclusion == "success"/);
  assert.match(promotion.run, /reason="could not list successful cli CI push runs"/);
  assert.match(promotion.run, /reason="could not inspect cli CI run \$run_id"/);
  assert.match(promotion.run, /echo "promotion mutation reuse: \$reason"/);

  // Main can skip mutations only for the exact two-parent promotion merge whose tree is the
  // snapshot already gated on next. Any git or associated-PR proof mismatch remains untrusted.
  assert.match(promotion.run, /EVENT_NAME" == "push" && "\$GITHUB_REF" == "refs\/heads\/main"/);
  assert.match(promotion.run, /git rev-list --parents -n 1 "\$CURRENT_SHA"/);
  assert.match(promotion.run, /-z "\$snapshot_sha" \|\| -n "\$\{extra_parent:-\}"/);
  assert.match(promotion.run, /git rev-parse "\$snapshot_sha\^\{tree\}"/);
  assert.match(promotion.run, /"\$main_tree" != "\$snapshot_tree"/);
  assert.match(promotion.run, /\/repos\/\$REPO\/commits\/\$CURRENT_SHA\/pulls/);
  assert.match(promotion.run, /\.base\.ref == "main"/);
  assert.match(promotion.run, /\.head\.ref \| test\("\^promote\/next-to-main-\[0-9\]\+\$"\)/);
  assert.match(promotion.run, /\.merged_at != null/);
  assert.match(promotion.run, /"\$base_repo" == "\$REPO"/);
  assert.match(promotion.run, /"\$head_repo" == "\$REPO"/);
  assert.match(promotion.run, /"\$pr_head_sha" == "\$snapshot_sha"/);
  assert.match(promotion.run, /"\$merge_commit_sha" == "\$CURRENT_SHA"/);
  assert.match(promotion.run, /"\$matching_prs" -ne 1/);
  assert.match(promotion.run, /HEAD_SHA="\$snapshot_sha"/);

  assert.match(mutation.run, /steps\.promotion\.outputs\.trusted.*== "true"/);
  assert.match(mutation.run, /legs='\[\]'/);
  assert.match(mutation.run, /sharded='\[\]'/);
  assert.match(mutation.run, /else[\s\S]*mutation-scopes-to-run\.mjs/);
  assert.equal(workflow.jobs["cli-mutation"].if, "needs.changes.outputs.mutation_legs != '[]'");
  // The scoring job runs whatever its shards did, so a crashed shard fails it, never skips it.
  assert.match(workflow.jobs["cli-mutation-score"].if, /^always\(\) && needs\.changes\.outputs\.mutation_sharded != '\[\]'/);

  // These checks validate the current PR merge ref or main commit; reuse never turns them off.
  for (const name of [
    "cli-typecheck",
    "cli-lint",
    "cli-architecture",
    "cli-coverage",
    "cli-smoke",
    "cli-build",
    "cli-knip",
    "identifier-join",
    "claude-tokens",
    "cli-jscpd",
    "kanban-checks",
    "windows",
  ]) {
    assert.deepEqual(workflow.jobs[name].needs, ["changes"], `${name} must still depend on changes`);
    assert.equal(
      workflow.jobs[name].if,
      "needs.changes.outputs.relevant == 'true'",
      `${name} must still run for a relevant promotion PR`
    );
  }
});

// Only a scope with a floor may fail a run: the others report their score. The workflow says
// so by letting a leg without `blocking` fail without failing the job, and the weekly run is
// also a manual one.
test("a mutation leg without a floor cannot fail the run, and the weekly run can be started by hand", () => {
  const workflow = cliCiWorkflow();

  assert.ok("workflow_dispatch" in workflow.on);
  assert.ok("schedule" in workflow.on);
  for (const job of ["cli-mutation", "cli-mutation-score"]) {
    assert.equal(workflow.jobs[job]["continue-on-error"], "${{ !matrix.blocking }}", job);
  }
  assert.match(
    JSON.stringify(workflow.jobs["cli-mutation"].steps),
    /github\.event_name != 'pull_request' && github\.event_name != 'push' && '--force'/
  );
});

// The Windows checks run as parallel parts so none sets the wall clock of a pull request. Each
// part must own at least one step, every check that ran serially must still run, and the
// architecture suite stays on Linux: it is static source analysis, the same on any OS.
test("Windows runs every check in parallel parts, none of them the architecture suite", () => {
  const windows = cliCiWorkflow().jobs.windows;
  const parts = windows.strategy.matrix.part;
  const steps = windows.steps.filter((step) => step.if !== undefined);

  assert.ok(parts.length > 1);
  for (const part of parts) {
    assert.ok(
      steps.some((step) => step.if === `matrix.part == '${part}'`),
      `no step runs for the ${part} part`
    );
  }
  for (const step of steps) {
    assert.ok(
      parts.some((part) => step.if === `matrix.part == '${part}'`),
      `${step.name} is guarded by an unknown part`
    );
  }
  const commands = steps.map((step) => step.run).join("\n");
  for (const check of [
    "node --test",
    "lefthook run pre-commit",
    "pnpm test:unit",
    "pnpm test:contract",
    "pnpm test:integration",
    "aidd --version",
    "--project=e2e --project=golden",
  ]) {
    assert.ok(commands.includes(check), `no Windows step runs ${check}`);
  }
  assert.ok(!/test:arch|--project=architecture/.test(commands), "the architecture suite runs on Windows");
});

// The Windows and macOS jobs are the only runs of the plugin suite off Linux, and a plugin's
// bundled script or hook is what handles paths and line endings there. Runs the filter's own
// `case` under bash, so the assertion is what the workflow decides, not a reading of its text.
test("the changes filter runs the suite for a plugin's bundled script or hook, not its prose", () => {
  const script = cliCiWorkflow().jobs.changes.steps.map((step) => step.run ?? "").join("\n");
  const filter = script.match(/^\s*case "\$f" in\n[\s\S]*?^\s*esac$/m);
  assert.ok(filter, "the relevance filter must be a `case \"$f\" in ... esac` block");
  const decide = (file) =>
    spawnSync("bash", ["-c", `relevant=false\nf="$1"\n${filter[0]}\necho "$relevant"`, "filter", file], {
      encoding: "utf8",
    }).stdout.trim();

  assert.equal(decide("plugins/aidd-context/skills/05-rule-generate/scripts/write-rule.cjs"), "true");
  assert.equal(decide("plugins/aidd-context/hooks/memory.cjs"), "true");
  assert.equal(decide("plugins/aidd-telemetry/hooks/lib/record.cjs"), "true");
  assert.equal(decide("plugins/aidd-context/skills/05-rule-generate/SKILL.md"), "false");
});
