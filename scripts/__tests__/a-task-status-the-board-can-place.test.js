const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  ALLOWED_STATUSES,
  BANKS,
  declaredStatus,
  markdownFiles,
  offVocabularyStatuses,
} = require("../check-task-status.js");

const root = path.resolve(__dirname, "../..");

test("declaredStatus reads the status from the frontmatter block only", () => {
  const content = [
    "---",
    "objective: ship it",
    "status: pending",
    "---",
    "",
    "# Plan",
    "",
    "status: garbage in the body is prose, not a declaration",
  ].join("\n");

  assert.deepEqual(declaredStatus(content), { value: "pending", line: 3 });
});

test("declaredStatus reports nothing for a document without frontmatter or without status", () => {
  assert.equal(declaredStatus("# Memory page\n\nNo frontmatter here."), undefined);
  assert.equal(declaredStatus("---\nname: brief\n---\n\n# Brief"), undefined);
});

test("declaredStatus reads a CRLF document the way the board's parser does", () => {
  // A Windows checkout's core.autocrlf writes CRLF (the CLI golden test normalizes it for
  // the same reason); gray-matter parses it, so a CRLF status must not slip past the gate.
  assert.deepEqual(declaredStatus("---\r\nstatus: draft\r\n---\r\n"), {
    value: "draft",
    line: 2,
  });
});

test("declaredStatus reads quoted values and inline comments the way YAML does", () => {
  // gray-matter sees `pending` in both; flagging them would reject a document the board places.
  assert.deepEqual(declaredStatus('---\nstatus: "pending"\n---\n'), {
    value: "pending",
    line: 2,
  });
  assert.deepEqual(declaredStatus("---\nstatus: 'pending'\n---\n"), {
    value: "pending",
    line: 2,
  });
  assert.deepEqual(declaredStatus("---\nstatus: pending # wip note\n---\n"), {
    value: "pending",
    line: 2,
  });
});

test("every lifecycle and creation status passes", () => {
  for (const status of ALLOWED_STATUSES) {
    const content = `---\nstatus: ${status}\n---\n`;
    assert.deepEqual(offVocabularyStatuses(content), [], `"${status}" should be allowed`);
  }
});

test("a status the board cannot place is flagged with its line", () => {
  const content = "---\ntype: plan\nstatus: delivered\n---\n";

  assert.deepEqual(offVocabularyStatuses(content), [{ value: "delivered", line: 3 }]);
});

test("every status the kanban maps onto a column is allowed here", () => {
  // One-way: the board may map more than documents write, never less. A value the
  // kanban places that this gate rejects would force authors off the board's own vocabulary.
  const mappingSource = fs.readFileSync(
    path.join(root, "kanban/src/domain/models/progress-status.ts"),
    "utf-8"
  );
  const mappingBlock = mappingSource.match(
    /RAW_STATUS_TO_PROGRESS_STATUS[^=]*=\s*\{([^}]*)\}/u
  );
  assert.ok(mappingBlock, "kanban raw-status mapping not found");

  const mappedStatuses = [...mappingBlock[1].matchAll(/^\s*"?([\w-]+)"?:/gmu)]
    .map((match) => match[1])
    .filter((status) => status !== "unknown");

  assert.ok(mappedStatuses.length > 0, "no mapped statuses parsed");
  for (const status of mappedStatuses) {
    assert.ok(
      ALLOWED_STATUSES.includes(status),
      `kanban maps "${status}" but the gate rejects it`
    );
  }
});

test("the repository's own banks hold no off-vocabulary status", () => {
  const violations = [];

  for (const bank of BANKS) {
    const bankPath = path.join(root, bank);
    if (!fs.existsSync(bankPath)) continue;

    for (const filePath of markdownFiles(bankPath)) {
      for (const finding of offVocabularyStatuses(fs.readFileSync(filePath, "utf-8"))) {
        violations.push(`${path.relative(root, filePath)}:${finding.line} "${finding.value}"`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
