const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { checkRouterCoherence } = require("../lib/architecture-rules.js");

const ROOT = path.resolve(__dirname, "../..");
const TICK = "`";

/**
 * Rule two decided by one property, over every shape a router is written in, instead of one
 * test per shape someone happened to think of.
 *
 * The property: a section that cites every action file it provides is silent, and removing any
 * one of those citations yields exactly one violation — the one naming that file.
 *
 * The shapes are generated rather than random. A guard that fails on a seed nobody can reproduce
 * is worse than no guard, and the repository's own root holds six dev dependencies, none of them
 * a generator library. The matrix below is small enough to enumerate and wide enough to cover
 * what six rounds of review found by hand.
 */

const HEADERS = {
  bare: ["| Action | Does |"],
  numbered: ["| # | Action | Role |"],
  plural: ["| # | Actions | Role |"],
};

const SEPARATORS = {
  three: "---",
  two: "--",
  aligned: ":---",
};

/** How a row names the action it routes to. Each is a citation shape the engine accepts. */
const CITATIONS = {
  stem: (name) => stemOf(name),
  backtickedStem: (name) => `${TICK}${stemOf(name)}${TICK}`,
  numberedName: (name) => name.replace(/\.md$/, ""),
  backtickedFile: (name) => `${TICK}${name}${TICK}`,
};

/** Text placed around the router that must not change any verdict. */
const NOISE = {
  none: () => [],
  prose: (names) => [
    "",
    `Run them in order. The ${stemOf(names[0])} step is the culmination, and ${stemOf(
      names[names.length - 1]
    )} closes it.`,
  ],
  glossaryTable: () => ["", "| Term | Synonym |", "| --- | --- |", "| step | move |"],
  fencedExample: (names) => [
    "",
    "An example of the shape a router takes:",
    "",
    "```md",
    "| # | Action | Role |",
    "| --- | --- | --- |",
    `| 99 | ${stemOf(names[names.length - 1])} | an example, not a router |`,
    "```",
  ],
  /** The same example, citing a file name rather than a stem: the shape that reads through a
   * fence for the path form and must not for this one. */
  fencedFilename: (names) => [
    "",
    "```md",
    "| # | Action | Role |",
    "| --- | --- | --- |",
    `| 99 | ${TICK}${names[names.length - 1]}${TICK} | an example, not a router |`,
    "```",
  ],
  trailingParagraph: () => ["", "Before running an action, read its file in `actions/`."],
};

function stemOf(name) {
  return name.replace(/\.md$/, "").replace(/^\d+-/, "");
}

/** One `SKILL.md` body, built from the matrix. `omit` is the action file left uncited. */
function buildSkill({ header, separator, citation, noise, names, omit, splitAfter }) {
  const headerRow = HEADERS[header][0];
  const columns = headerRow.split("|").filter((cell) => cell.trim() !== "").length;
  const separatorRow = `| ${Array.from({ length: columns }, () => SEPARATORS[separator]).join(" | ")} |`;

  const rows = [];
  names.forEach((name, index) => {
    if (name === omit) return;
    if (splitAfter !== undefined && index === splitAfter) rows.push("");
    const cited = CITATIONS[citation](name);
    rows.push(columns === 2 ? `| ${cited} | does it |` : `| 0${index + 1} | ${cited} | does it |`);
  });

  return [
    "# Generated skill",
    "",
    "## Actions",
    "",
    headerRow,
    separatorRow,
    ...rows,
    ...NOISE[noise](names),
    "",
    "## Transversal rules",
    "",
    "- Nothing.",
  ].join("\n");
}

const NAMES = ["01-first.md", "02-second.md", "03-third.md"];
const FILE = "plugins/aidd-fixture-a/skills/01-generated/SKILL.md";

function shapes() {
  const out = [];
  for (const header of Object.keys(HEADERS)) {
    for (const separator of Object.keys(SEPARATORS)) {
      for (const citation of Object.keys(CITATIONS)) {
        for (const noise of Object.keys(NOISE)) {
          for (const splitAfter of [undefined, 1]) {
            out.push({ header, separator, citation, noise, splitAfter });
          }
        }
      }
    }
  }
  return out;
}

function describe(shape, omit) {
  const split = shape.splitAfter === undefined ? "unsplit" : "split by a blank line";
  return `${shape.header} header, ${shape.separator} separator, ${shape.citation} citation, ${shape.noise} noise, ${split}${
    omit ? `, omitting ${omit}` : ""
  }`;
}

test("every shape that cites all its actions is silent", () => {
  const failures = [];
  for (const shape of shapes()) {
    const content = buildSkill({ ...shape, names: NAMES, omit: null });
    const violations = checkRouterCoherence(FILE, content, NAMES);
    if (violations.length !== 0) {
      failures.push(`${describe(shape)} => ${violations.map((v) => v.message).join(" | ")}`);
    }
  }
  assert.deepEqual(failures, [], `a router shape was refused although it cites every action:\n${failures.join("\n")}`);
});

test("every shape that drops one citation yields exactly that one violation", () => {
  const failures = [];
  for (const shape of shapes()) {
    for (const omit of NAMES) {
      const content = buildSkill({ ...shape, names: NAMES, omit });
      const violations = checkRouterCoherence(FILE, content, NAMES);
      if (violations.length !== 1) {
        failures.push(`${describe(shape, omit)} => ${violations.length} violations`);
        continue;
      }
      if (!violations[0].message.includes(omit)) {
        failures.push(`${describe(shape, omit)} => named ${violations[0].message}`);
      }
    }
  }
  assert.deepEqual(failures, [], `a dropped citation was missed or misattributed:\n${failures.join("\n")}`);
});

test("the shape matrix is wide enough to be worth running", () => {
  // A generator that silently produces nothing passes every property above. Pin the count so a
  // matrix that collapses fails here rather than going quietly green.
  // 3 headers x 3 separators x 4 citation shapes x 6 noises x 2 split positions.
  assert.equal(shapes().length, 432);
});

/**
 * The same property against the repository's own routers, which is where it has to hold: every
 * action the tree provides is cited, and removing the line that cites it is caught.
 */
function realSkills() {
  const skills = [];
  const pluginsDir = path.join(ROOT, "plugins");
  for (const owner of fs.readdirSync(pluginsDir)) {
    const skillsDir = path.join(pluginsDir, owner, "skills");
    if (!fs.existsSync(skillsDir)) continue;
    for (const skill of fs.readdirSync(skillsDir)) {
      const skillMd = path.join(skillsDir, skill, "SKILL.md");
      const actionsDir = path.join(skillsDir, skill, "actions");
      if (!fs.existsSync(skillMd) || !fs.existsSync(actionsDir)) continue;
      const names = fs.readdirSync(actionsDir).filter((name) => name.endsWith(".md"));
      if (names.length === 0) continue;
      skills.push({
        relPath: `plugins/${owner}/skills/${skill}/SKILL.md`,
        content: fs.readFileSync(skillMd, "utf8"),
        names,
      });
    }
  }
  return skills;
}

/** The skill's content with every table row citing `name` removed. */
function withoutCitationOf(content, name) {
  const stem = stemOf(name).toLowerCase();
  const noExt = name.replace(/\.md$/, "").toLowerCase();
  return content
    .split("\n")
    .filter((line) => {
      if (!/^\s*\|/.test(line)) return true;
      const cells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim().replace(/^`|`$/g, "").toLowerCase());
      return !cells.includes(stem) && !cells.includes(noExt) && !cells.includes(name.toLowerCase());
    })
    .join("\n");
}

test("every router in the tree cites every action it provides", () => {
  const failures = [];
  for (const { relPath, content, names } of realSkills()) {
    const violations = checkRouterCoherence(relPath, content, names);
    if (violations.length > 0) failures.push(`${relPath} => ${violations.map((v) => v.message).join(" | ")}`);
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("removing a real router's citation is caught, for every action in the tree", () => {
  // `aidd-dev:10-todo` names its one action as a fenced path rather than a table row, so there
  // is no row to remove and nothing to catch. It is the one documented exception.
  const FENCED_PATH_SKILL = "plugins/aidd-dev/skills/10-todo/SKILL.md";
  const missed = [];
  let checked = 0;

  for (const { relPath, content, names } of realSkills()) {
    if (relPath === FENCED_PATH_SKILL) continue;
    for (const name of names) {
      checked += 1;
      const violations = checkRouterCoherence(relPath, withoutCitationOf(content, name), names);
      if (!violations.some((violation) => violation.message.includes(name))) {
        missed.push(`${relPath} ${name}`);
      }
    }
  }

  assert.deepEqual(missed, [], `a deleted citation went unnoticed:\n${missed.join("\n")}`);
  assert.ok(checked > 100, `expected the tree to offer more than 100 citations to remove, got ${checked}`);
});
