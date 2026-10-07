const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

/**
 * A task folder declares the backlog item it delivers in `backlog-link.json`, and the whole
 * `by_backlog` axis rests on that one file being readable. A writer spelling the fields in
 * camelCase while the reader looks for snake_case makes every declaration unreadable, in
 * silence.
 *
 * The reader is a `cli/` module and this is a repository script test, so the rule is restated
 * here rather than imported across that boundary — and the second case below is what keeps
 * the restatement honest.
 */
const IDENTIFYING_FIELD = "backlog";
const REQUIRED_FIELDS = [IDENTIFYING_FIELD, "written_at", "written_by"];

function shapeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value;
}

/** The taught example is the first json fence, the same one
 * `cli/tests/contexts/telemetry/infrastructure/task-backlog-skill-shape.integration.test.ts`
 * reads: two guards disagreeing on which fence that is leaves one green and the other red. */
function taughtInMarkdown(file, markdown) {
  const fences = [...markdown.matchAll(/^[ \t]*```json\r?\n([\s\S]*?)\r?\n[ \t]*```/gmu)].map((m) => m[1]);
  assert.ok(fences.length > 0, `${file} must teach the example in a json fence`);

  const taught = taughtAsJson(file, fences[0]);
  assert.ok(
    IDENTIFYING_FIELD in taught,
    `${file}'s first json fence must be the taught example, carrying "${IDENTIFYING_FIELD}". ` +
      `Read ${fences.length} fence(s).`
  );
  return taught;
}

function taughtAsJson(file, text) {
  let taught;
  try {
    taught = JSON.parse(text);
  } catch (error) {
    assert.fail(`${file} teaches an example that is not JSON: ${error.message}`);
  }
  assert.ok(
    taught !== null && typeof taught === "object" && !Array.isArray(taught),
    `${file} must teach an object, not ${shapeOf(taught)}`
  );
  return taught;
}

function trackedBacklogLinks() {
  return cp
    .execSync("git ls-files '*backlog-link.json'", { cwd: ROOT, encoding: "utf8" })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
}

describe("every backlog declaration in this repository is one the report can read", () => {
  it("names the fields the reader looks for, in the spelling it looks for them", () => {
    const unreadable = [];

    for (const file of trackedBacklogLinks()) {
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
      } catch (error) {
        unreadable.push(`${file} is not JSON: ${error.message}`);
        continue;
      }
      const missing = REQUIRED_FIELDS.filter(
        (field) => typeof parsed[field] !== "string" || parsed[field] === ""
      );
      if (missing.length > 0) {
        unreadable.push(
          `${file} is missing ${missing.join(", ")} (has ${Object.keys(parsed).join(", ")})`
        );
      }
    }

    assert.deepEqual(
      unreadable,
      [],
      `A task folder declares a backlog item the report cannot read, so its work counts as ` +
        `\`unreadable\` and the item is never named.\n${unreadable.join("\n")}`
    );
  });

  /** The two skills that teach the file are the only things that decide what gets written,
   * so they have to teach the same three names, and the same three this test asks for.
   * Read from the skills rather than trusted: a taught shape drifting away from the reader
   * is exactly what produced the two unreadable files, and a guard restating the fields
   * without checking the lesson would have stayed green through it. The example is parsed,
   * not searched: a file that keeps the three names while ceasing to be JSON is unreadable
   * to the reader all the same. */
  it("is the shape both skills that write it actually teach", () => {
    const TEACHING_FILES = [
      "plugins/aidd-pm/skills/04-spec/assets/backlog-link-template.json",
      "plugins/aidd-dev/skills/01-plan/actions/04-plan.md",
    ];

    for (const file of TEACHING_FILES) {
      const text = fs.readFileSync(path.join(ROOT, file), "utf8");
      const taught = file.endsWith(".md") ? taughtInMarkdown(file, text) : taughtAsJson(file, text);
      for (const field of REQUIRED_FIELDS) {
        assert.ok(
          typeof taught[field] === "string" && taught[field] !== "",
          `${file} must teach the field "${field}" as a non-empty string`
        );
      }
    }
  });

  /** The check above pins the writer's side alone, which would stay green through a
   * writer/reader disagreement. This reads `TaskBacklogAdapter.read`'s own field access, in
   * `cli/` across the boundary this file's header explains it does not import across. */
  it("is the shape the reader in cli/ actually reads, not just the shape skills teach", () => {
    const READER_FILE = "cli/src/contexts/telemetry/infrastructure/task-backlog-adapter.ts";
    const text = fs.readFileSync(path.join(ROOT, READER_FILE), "utf8");

    for (const field of REQUIRED_FIELDS) {
      assert.ok(
        text.includes(`parsed.${field}`),
        `${READER_FILE} must read \`parsed.${field}\`, the same field the skills teach`
      );
    }
  });
});
