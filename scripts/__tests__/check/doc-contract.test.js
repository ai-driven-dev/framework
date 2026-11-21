const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { describe, it, beforeEach, afterEach } = require("node:test");
const { findings } = require("./helpers.js");

const CONTRACT = path.resolve(__dirname, "../../check/contracts/doc.json");
const SENTENCE = "this sentence is long enough to count as a fact that two pages should never both carry in full";

/** A small clean repository: every DOC rule is silent on it. */
const CLEAN = {
  "README.md": "# Repo\n\nSee [guide](docs/guide.md#start).\n",
  "docs/guide.md": "# Guide\n\n## Start\n\nRun `docs/guide.md` first.\n",
  "CLAUDE.md": "# Claude\n\n<!-- aidd_project_memory:start -->\n\n@docs/guide.md\n<!-- aidd_project_memory:end -->\n",
  "AGENTS.md": "# Agents\n\n<!-- aidd_project_memory:start -->\n\n[guide](docs/guide.md)\n<!-- aidd_project_memory:end -->\n",
  "docs/ARCHITECTURE.md": "# Architecture\n\n| Plugin | Owns |\n| --- | --- |\n| `aidd-context` | Knowledge |\n",
  "plugins/aidd-context/hooks/memory.cjs": 'const TARGET_FILES = [{ path: "CLAUDE.md", syntax: "at" }, { path: "AGENTS.md", syntax: "link" }];\n',
};

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "doc-contract-"));
  put(CLEAN);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function put(files) {
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
}

const ids = () => [...new Set(findings(CONTRACT, path.join(dir, "README.md")).map((f) => f.id))];

describe("doc contract", () => {
  it("accepts a clean repository", () => {
    assert.deepEqual(findings(CONTRACT, path.join(dir, "README.md")), []);
  });

  it("DOC-01 flags a link to nothing, and a fragment no heading answers", () => {
    put({ "docs/guide.md": "# Guide\n\n[x](nowhere.md)\n" });
    assert.deepEqual(ids(), ["DOC-01"]);
    put({ "docs/guide.md": "# Guide\n\n[x](guide.md#nope)\n" });
    assert.deepEqual(ids(), ["DOC-01"]);
  });

  it("DOC-01 reports the file and line of the broken link, not the anchor", () => {
    put({ "docs/guide.md": "# Guide\n\n[x](nowhere.md)\n" });
    const [found] = findings(CONTRACT, path.join(dir, "README.md"));
    assert.deepEqual([found.path, found.line], [path.join(dir, "docs/guide.md"), 3]);
  });

  it("DOC-01 leaves skill markdown to SKILL-17", () => {
    put({ "plugins/aidd-context/skills/01-a/SKILL.md": "# A\n\n[x](nowhere.md)\n" });
    assert.deepEqual(ids(), []);
  });

  it("DOC-02 flags a backticked path naming nothing on disk", () => {
    put({ "docs/guide.md": "# Guide\n\n## Start\n\nSee `docs/missing.md`.\n" });
    assert.deepEqual(ids(), ["DOC-02"]);
  });

  it("DOC-03 flags an import inside an HTML block", () => {
    put({ "CLAUDE.md": "# Claude\n\n<div>\n@docs/guide.md\n</div>\n" });
    assert.deepEqual(ids(), ["DOC-03"]);
  });

  it("DOC-05 flags a sentence carried by two documents", () => {
    put({ "README.md": `${CLEAN["README.md"]}\n${SENTENCE}.\n`, "docs/guide.md": `${CLEAN["docs/guide.md"]}\n${SENTENCE}.\n` });
    assert.deepEqual(ids(), ["DOC-05"]);
  });

  it("DOC-06 flags a Mermaid class named like a node", () => {
    put({ "docs/guide.md": `${CLEAN["docs/guide.md"]}\n\`\`\`mermaid\nflowchart TD\n  classDef Box fill:#fff\n  Box[a] --> B[b]\n\`\`\`\n` });
    assert.deepEqual(ids(), ["DOC-06"]);
  });

  it("DOC-07 flags a plugin with no row, and a row with no plugin", () => {
    put({ "plugins/aidd-x/README.md": "# X\n" });
    assert.deepEqual(ids(), ["DOC-07"]);
    fs.rmSync(path.join(dir, "plugins/aidd-x"), { recursive: true });
    put({ "docs/ARCHITECTURE.md": "# Architecture\n\n| Plugin | Owns |\n| --- | --- |\n| `aidd-context` | Knowledge |\n| `aidd-gone` | Nothing |\n" });
    assert.deepEqual(ids(), ["DOC-07"]);
  });
});
