const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");

const custom = (name) => require(path.resolve(__dirname, `../../check/contracts/custom/${name}.cjs`));

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "doc-checks-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const put = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
};
const anchor = (name = "README.md") => ({ root: dir, abs: path.join(dir, name) });

describe("mermaid-names", () => {
  const { collisions } = custom("mermaid-names");

  it("names a class also used as a node or a subgraph", () => {
    assert.deepEqual(collisions("flowchart TD\n  classDef Box fill:#fff\n  Box[a] --> B[b]"), ["Box"]);
    assert.deepEqual(collisions("flowchart TD\n  classDef Group fill:#fff\n  subgraph Group\n    A --> B\n  end"), ["Group"]);
  });

  it("lets a class keep a name no node uses", () => {
    assert.deepEqual(collisions("flowchart TD\n  classDef hot fill:#fff\n  A[a] --> B[b]\n  class A hot"), []);
  });
});

describe("json-valid", () => {
  const { problemsOf } = custom("json-valid");

  it("reads Claude settings: enabledPlugins holds booleans", () => {
    assert.deepEqual(problemsOf(dir, ".claude/settings.json", { enabledPlugins: { a: true } }), []);
    assert.deepEqual(problemsOf(dir, ".claude/settings.json", { enabledPlugins: { a: "yes" } }), ["enabledPlugins.a must be boolean"]);
  });

  it("flags a duplicate marketplace plugin name", () => {
    const plugin = { name: "a", source: ".", description: "d", strict: true, metadata: { recommended: false } };
    const data = { name: "m", version: "1", description: "d", owner: { name: "o" }, plugins: [plugin, plugin] };
    assert.deepEqual(problemsOf(dir, ".claude-plugin/marketplace.json", data), ["duplicate plugin name: a"]);
  });

  it("holds any other JSON file to syntax only", () => {
    assert.deepEqual(problemsOf(dir, "anything.json", { whatever: 1 }), []);
  });
});

describe("markdown-links", () => {
  const { linkChecker } = custom("markdown-links");

  it("suggests the GitHub address for a link leaving the repository", () => {
    put("README.md", "[x](../elsewhere/file.md)\n");
    const [problem] = linkChecker(dir).checkFile(path.join(dir, "README.md"));
    assert.equal(problem.reason, "cross-repo-relative-link");
  });

  it("answers a fragment from the target's headings, fences skipped", () => {
    put("a.md", "[ok](b.md#real-heading) [bad](b.md#fenced)\n");
    put("b.md", "# Real heading\n\n```\n# Fenced\n```\n");
    const problems = linkChecker(dir).checkFile(path.join(dir, "a.md"));
    assert.deepEqual(problems.map((p) => p.reason), ["anchor-not-found"]);
  });

  it("skips the trees that hold targets meant not to resolve", () => {
    put("cli/tests/fixtures/x.md", "[x](nowhere.md)\n");
    put("node_modules/p/x.md", "[x](nowhere.md)\n");
    put("README.md", "fine\n");
    assert.deepEqual(custom("markdown-links")(anchor()), []);
  });
});

describe("referenced-paths", () => {
  it("resolves a backticked file under a real top-level entry, and skips what the reader creates", () => {
    put("README.md", "`docs/a.md` `.aidd/config.json` `src/none.ts` `docs/b.md`\n");
    put("docs/a.md", "x\n");
    const found = custom("referenced-paths")(anchor());
    assert.deepEqual(found.map((f) => f.offending), ["docs/b.md"]);
  });
});

describe("doc-duplication", () => {
  const sentence = "this sentence is long enough to count as a fact that two pages should never both carry in full";

  it("counts only a sentence carried by more than one file, and skips generated catalogs", () => {
    put("README.md", `${sentence}.\n\n${sentence}.\n`);
    put("docs/a.md", "short\n");
    assert.deepEqual(custom("doc-duplication")(anchor()), []);
    put("docs/CATALOG.md", `${sentence}.\n`);
    assert.deepEqual(custom("doc-duplication")(anchor()), []);
    put("docs/a.md", `${sentence}.\n`);
    assert.equal(custom("doc-duplication")(anchor()).length, 1);
  });
});

describe("context-imports", () => {
  const { findHiddenImports } = custom("context-imports");

  it("flags an import in an HTML block, not one after a blank line or in a fence", () => {
    assert.equal(findHiddenImports("<div>\n@a.md\n").length, 1);
    assert.equal(findHiddenImports("<div>\n\n@a.md\n").length, 0);
    assert.equal(findHiddenImports("```\n<div>\n@a.md\n```\n").length, 0);
  });
});

describe("context-reference-form", () => {
  const { referenceFormProblems } = custom("context-reference-form");
  const block = (line) => `<!-- aidd_project_memory:start -->\n${line}\n<!-- aidd_project_memory:end -->\n`;

  it("holds each file to the form its tool resolves, and ignores a block left unpaired", () => {
    assert.equal(referenceFormProblems(block("[a](a.md)"), "at").length, 1);
    assert.equal(referenceFormProblems(block("@a.md"), "at").length, 0);
    assert.equal(referenceFormProblems("<!-- aidd_project_memory:start -->\n[a](a.md)\n", "at").length, 0);
  });
});
