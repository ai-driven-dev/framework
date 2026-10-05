const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it } = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const PROBE_SOURCE = path.posix.join("plugins", "probe", "skills", "01-probe", "actions", "probe.md");

/**
 * A skill ships two ways and a relative path survives only one of them: the tree ships flat
 * and as a marketplace. `check-markdown-links.js` resolves every link against this
 * repository, where the target does exist, so a link reaching out of a skill passes there
 * and is dead in every installed copy.
 *
 * The skill's own directory is the boundary, not the plugin's. A link to a sibling skill, to
 * the plugin's README, or to anything in the repository is equally unreachable once a tool
 * has installed the skill somewhere of its own choosing; name the file in prose instead.
 * The router is already loaded, so links back to SKILL.md are redundant even when they
 * stay inside the skill.
 */

const SKILL_ROOT = /^plugins\/[^/]+\/skills\/[^/]+$/u;
const LINK_DESTINATION = /\]\(\s*(<[^>\n]+>|[^\s)]+)[^)\n]*\)/gu;

function decodedPath(target) {
  try {
    return decodeURI(target);
  } catch {
    return target;
  }
}

function everyMarkdownUnderPlugins(directory, into) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) everyMarkdownUnderPlugins(full, into);
    else if (entry.name.endsWith(".md")) into.push(full);
  }
  return into;
}

/** The skill directory a file belongs to, or `null` for a file outside every skill —
 * a plugin's own README, an agent, a command, which ship by different rules. */
function skillRootOf(relativePath) {
  const segments = relativePath.split("/");
  const root = segments.slice(0, 4).join("/");
  return SKILL_ROOT.test(root) ? root : null;
}

function skillLinkViolations(repository = ROOT) {
  const violations = [];
  for (const file of everyMarkdownUnderPlugins(path.join(repository, "plugins"), [])) {
    const relative = path.relative(repository, file).split(path.sep).join("/");
    const root = skillRootOf(relative);
    if (root === null) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const [, raw] of text.matchAll(LINK_DESTINATION)) {
      const target = raw.startsWith("<") && raw.endsWith(">") ? raw.slice(1, -1) : raw;
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/iu.test(target)) continue;
      const resolved = path
        .normalize(path.join(path.dirname(relative), decodedPath(target.split("#")[0])))
        .split(path.sep)
        .join("/");
      if (
        path.posix.basename(resolved) === "SKILL.md"
        || (resolved !== root && !resolved.startsWith(`${root}/`))
      ) {
        violations.push(`${relative} -> ${raw}`);
      }
    }
  }
  return violations;
}

function probeSkillLinks(markdown) {
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-skill-links-"));
  try {
    const skill = path.join(repository, "plugins", "probe", "skills", "01-probe");
    fs.mkdirSync(path.join(skill, "actions"), { recursive: true });
    fs.writeFileSync(path.join(skill, "actions", "probe.md"), markdown, "utf8");
    for (const file of ["README.md", "CATALOG.md"]) {
      fs.writeFileSync(
        path.join(repository, "plugins", "probe", file),
        "[skill](skills/01-probe/SKILL.md#rules)\n",
        "utf8",
      );
    }
    return skillLinkViolations(repository);
  } finally {
    fs.rmSync(repository, { recursive: true, force: true });
  }
}

describe("a skill links only inside itself, never back to its loaded router", () => {
  it("has no markdown link leaving its skill or returning to SKILL.md", () => {
    assert.doesNotMatch(
      fs.readFileSync(__filename, "utf8"),
      /(plugins|scripts)\//u,
      "synthetic fixture paths must not hide this repository-wide guard from changed-test selection",
    );
    assert.deepEqual(
      skillLinkViolations(),
      [],
      "links must stay inside their skill and never return to SKILL.md; the router is already loaded",
    );
  });

  it("rejects inline links back to a router, with or without a fragment", () => {
    const cases = [
      ["[router](../SKILL.md)", "../SKILL.md"],
      ["[rules](../SKILL.md#transversal-rules)", "../SKILL.md#transversal-rules"],
      ["[router](SKILL.md)", "SKILL.md"],
      ["[router](./SKILL.md)", "./SKILL.md"],
      ["[router](../SKILL.md \"already loaded\")", "../SKILL.md"],
      ["[rules](../SKILL.md#transversal-rules \"already loaded\")", "../SKILL.md#transversal-rules"],
      ["[router](<../SKILL.md>)", "<../SKILL.md>"],
      ["[rules](<../SKILL.md#transversal-rules>)", "<../SKILL.md#transversal-rules>"],
      ["[router](../SKILL%2Emd)", "../SKILL%2Emd"],
      ["[rules](../SKILL%2Emd#transversal-rules)", "../SKILL%2Emd#transversal-rules"],
    ];
    assert.deepEqual(
      probeSkillLinks(cases.map(([link]) => link).join("\n")),
      cases.map(([, target]) => `${PROBE_SOURCE} -> ${target}`),
    );
  });

  it("accepts actions, references, bare router mentions and README/catalog skill links", () => {
    assert.deepEqual(
      probeSkillLinks([
        "[action](./next.md)",
        "[reference](../references/rules.md#rule)",
        "[reference](<../references/rules.md> \"rules\")",
        "[reference](../references/rules%2Emd#rule)",
        "[reference](../references/100%coverage.md)",
        "The router SKILL.md is already loaded; apply `../SKILL.md` rules.",
        "[docs](https://example.com/guide)",
        "[section](#process)",
      ].join("\n")),
      [],
    );
  });

  // The guard has to be able to see one. A checker that resolves every path against this
  // repository, the way `check-markdown-links.js` does, reports nothing here at all.
  it("sees an escaping link when one is put in front of it", () => {
    const cases = [
      ["[out](../../../../README.md)", "../../../../README.md"],
      ["[out\ncontinued](../../../../README.md)", "../../../../README.md"],
      ["[out [nested]](../../../../README.md)", "../../../../README.md"],
      ["[out](%2E%2E/%2E%2E/%2E%2E/%2E%2E/README.md)", "%2E%2E/%2E%2E/%2E%2E/%2E%2E/README.md"],
      ["[out](../../../../README%ZZ.md)", "../../../../README%ZZ.md"],
    ];
    assert.deepEqual(
      probeSkillLinks(cases.map(([link]) => link).join("\n")),
      cases.map(([, target]) => `${PROBE_SOURCE} -> ${target}`),
    );
  });
});
