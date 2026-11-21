const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it } = require("node:test");
const { validate } = require("./helpers.js");

const SKILL = path.resolve(__dirname, "../../../plugins/aidd-refine/skills/02-challenge");
const SCRIPT = path.join(SKILL, "scripts/validate-challenge.cjs");

const ROUND_ONE = `# Round 1

Aim: a cart reservation that never sells the same item twice

# Deal breakers

- it releases the live cart instead of the reservation, evidence \`node test.js\` prints \`stock 2, expected 1\` → release \`reservation.items\`

# To decide

- the plan asks no expiry while abandoned carts hold stock forever, evidence plan.md step 2 → should a reservation expire?

# Suggestions

- None

# Holds

- two checkouts racing on the last item: the second is refused
  by the stock check at cart.js:12
`;

const ROUND_TWO = `
# Round 2

Aim: a cart reservation that never sells the same item twice

# Deal breakers

- None

# To decide

- None

# Suggestions

- the release loop repeats the reserve loop → share one helper

# Holds

- the release now frees the reservation, \`node test.js\` prints \`stock 1\`
`;

const GOOD = ROUND_ONE + ROUND_TWO;

/** The verdict on a challenge.md holding `text`. */
const check = (text) => validate(SCRIPT, "challenge.md", text);

/** Asserts `text` is refused by `id` and by no other rule. */
function refusedOnlyBy(text, id) {
  const { code, out } = check(text);
  assert.equal(code, 1, out);
  const ids = [...new Set(out.trim().split("\n").map((line) => line.split(" ")[1]))];
  assert.deepEqual(ids, [id], out);
}

describe("challenge contract", () => {
  it("accepts a report of two rounds filled from the template", () => {
    assert.deepEqual(check(GOOD), { code: 0, out: "", err: "" });
  });

  it("CHALLENGE-01 refuses text before the first round and a round out of sequence", () => {
    refusedOnlyBy(`Some preamble\n\n${GOOD}`, "CHALLENGE-01");
    refusedOnlyBy(GOOD.replace("# Round 2", "# Round 3"), "CHALLENGE-01");
    refusedOnlyBy("", "CHALLENGE-01");
  });

  it("CHALLENGE-02 refuses a round that opens without its aim", () => {
    refusedOnlyBy(GOOD.replace("Aim: a cart reservation that never sells the same item twice\n", ""), "CHALLENGE-02");
    refusedOnlyBy(GOOD.replace("Aim: a cart reservation that never sells the same item twice", "Aim:"), "CHALLENGE-02");
  });

  it("CHALLENGE-03 refuses a missing, renamed or reordered section", () => {
    refusedOnlyBy(GOOD.replace("# Holds\n\n- two checkouts", "# Verified\n\n- two checkouts"), "CHALLENGE-03");
    refusedOnlyBy(ROUND_ONE.replace(/# Suggestions\n\n- None\n\n/u, "") + ROUND_TWO, "CHALLENGE-03");
    refusedOnlyBy(ROUND_ONE + ROUND_TWO.replace("# Deal breakers", "# Swap").replace("# To decide", "# Deal breakers").replace("# Swap", "# To decide"), "CHALLENGE-03");
  });

  it("CHALLENGE-04 refuses an empty section, a None beside an item and a line that is no item", () => {
    refusedOnlyBy(GOOD.replace("# Suggestions\n\n- None\n", "# Suggestions\n\n"), "CHALLENGE-04");
    refusedOnlyBy(GOOD.replace("# Suggestions\n\n- None\n", "# Suggestions\n\n- None\n- extract a helper → share it\n"), "CHALLENGE-04");
    refusedOnlyBy(GOOD.replace("# Suggestions\n\n- None\n", "# Suggestions\n\nNothing to add.\n"), "CHALLENGE-04");
  });

  it("CHALLENGE-05 refuses a fourth To decide or Suggestion", () => {
    const four = Array.from({ length: 4 }, (_, i) => `- idea ${i} → change ${i}`).join("\n");
    refusedOnlyBy(GOOD.replace("# Suggestions\n\n- None\n", `# Suggestions\n\n${four}\n`), "CHALLENGE-05");
  });

  it("CHALLENGE-06 refuses a deal breaker without evidence", () => {
    refusedOnlyBy(GOOD.replace(", evidence `node test.js` prints `stock 2, expected 1`", ""), "CHALLENGE-06");
  });

  it("CHALLENGE-07 refuses a finding without its change", () => {
    refusedOnlyBy(GOOD.replace(" → share one helper", ""), "CHALLENGE-07");
  });

  it("CHALLENGE-08 refuses a To decide that asks no question", () => {
    refusedOnlyBy(GOOD.replace("should a reservation expire?", "add an expiry"), "CHALLENGE-08");
  });
});
