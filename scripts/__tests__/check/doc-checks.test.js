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
    put("cli/.stryker-tmp/sandbox/x.md", "[x](nowhere.md)\n");
    put("cli/.e2e-build/run/x.md", "[x](nowhere.md)\n");
    put(".tmp-check-markdown-links-1/x.md", "[x](nowhere.md)\n");
    put("README.md", "fine\n");
    assert.deepEqual(custom("markdown-links")(anchor()), []);
  });

  it("reads the markdown, @import and src: forms, and ignores anchors, mail, phone, URLs, placeholders and globs", () => {
    put("real.md", "# Real\n");
    put("page.md", [
      "[ok](real.md) ![img](real.md) @real.md", "src: real.md",
      "[anchor](#local) [mail](mailto:a@b.c) [phone](tel:+33123456789) <https://example.com> [url](https://example.com/x.md)",
      "src: $ARGUMENTS", "src: plugins/*/README.md", "src: README",
      "[bad](missing.md)", "@./missing-agent.md", "src: ./missing-source.md", "",
    ].join("\n"));
    const problems = linkChecker(dir).checkFile(path.join(dir, "page.md"));
    assert.deepEqual(problems.map((p) => p.raw), ["missing.md", "@./missing-agent.md", "./missing-source.md"]);
  });

  it("resolves a fragment the way GitHub slugs it, and leaves line fragments and non-markdown targets alone", () => {
    put("t.md", "# T\n\n## Commits\n\n## ✅ Code decisions\n");
    put("logo.png", "x");
    const check = (target) => linkChecker(dir).problemForTarget(target, path.join(dir, "s.md"))?.reason ?? null;
    assert.equal(check("./t.md#commits"), null);
    assert.equal(check("./t.md#-code-decisions"), null);
    assert.equal(check("./t.md#types"), "anchor-not-found");
    assert.equal(check("./t.md#L119"), null);
    assert.equal(check("./t.md#L119-L130"), null);
    assert.equal(check("./logo.png#anything"), null);
    assert.equal(check("./missing.md#commits"), "local-path-not-found");
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

describe("referenced-paths detection", () => {
  const { referencedPaths } = custom("referenced-paths");
  const targets = (text, entries) => referencedPaths(text, new Set(entries)).map((r) => r.target);

  it("reads a backticked file anchored on a real top-level entry", () => {
    assert.deepEqual(targets("The manifest is `.claude-plugin/marketplace.json`; config `release-please-config.json`.", [".claude-plugin", "release-please-config.json"]), [".claude-plugin/marketplace.json", "release-please-config.json"]);
  });

  it("ignores what only looks like a path", () => {
    const text = [
      "Accept `application/json` and `application/vnd.github+json`.",
      "A port lives under `domain/ports`.",
      "Run `pnpm test:changed`, then `cd cli && pnpm test`.",
      "The tag is `<plugin>-v<semver>` and the file `<root>/.aidd/auth.json`.",
      "Node `>=22.12`. A tool reads `.claude/skills/` in the user's project.",
    ].join("\n");
    assert.deepEqual(targets(text, ["domain", "cli", "<root>", ".claude"]), []);
  });

  it("skips what an install writes into the reader's project, though its anchor exists here", () => {
    assert.deepEqual(targets("Opt in with `.aidd/config.json`; the hook lands in `.agents/hooks.json`.", [".aidd", ".agents"]), []);
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
    assert.deepEqual(custom("doc-duplication")(anchor()).map((f) => f.file), ["README.md", "docs/a.md"]);
  });
});

describe("doc-duplication detection", () => {
  const { sentencesOf, carriersOf } = custom("doc-duplication");
  const TWELVE = "The manifest lists every plugin this repository ships to its users today.";
  const ELEVEN = "The manifest lists every plugin this repository ships to its users.";
  const NORMALISED = "the manifest lists every plugin this repository ships to its users today";

  it("keeps a sentence of twelve words and drops one of eleven", () => {
    assert.deepEqual(sentencesOf(`${TWELVE}\n\n${ELEVEN}\n`), [NORMALISED]);
  });

  it("matches across a link, a backtick, case and whitespace", () => {
    const dressed = "The `manifest` lists every [plugin](../plugins/README.md) this   Repository ships to its users today.";
    assert.deepEqual(carriersOf({ "a.md": TWELVE, "b.md": dressed }).get(NORMALISED), ["a.md", "b.md"]);
  });

  it("reads nothing out of a fence, a table row, a heading or a front matter", () => {
    for (const text of [`\`\`\`md\n${TWELVE}\n\`\`\`\n`, `\`\`\`mermaid\n${TWELVE}\n\`\`\`\n`, `| ${TWELVE} |\n`, `## ${TWELVE}\n`, `---\ntitle: ${TWELVE}\n---\n`]) {
      assert.deepEqual(sentencesOf(text), [], text);
    }
  });
});

describe("context-imports", () => {
  const { findHiddenImports } = custom("context-imports");

  it("hides an import in a bare tag block or glued to a comment marker, not one on a bare line", () => {
    const hidden = findHiddenImports("<aidd_project_memory>\n@aidd_docs/memory/vcs.md\n</aidd_project_memory>");
    assert.deepEqual([hidden.length, hidden[0].line, hidden[0].openedBy.text], [1, 2, "<aidd_project_memory>"]);
    assert.equal(findHiddenImports("<!-- aidd_project_memory:start -->\n@aidd_docs/memory/vcs.md").length, 1);
    assert.equal(findHiddenImports("# Title\n\n@a.md\n").length, 0);
  });

  it("closes a fence only on a fence as long, never on a shorter one inside it", () => {
    assert.equal(findHiddenImports("````markdown\n```\n<tag>\n@a.md\n```\n````\n").length, 0);
  });

  it("flags an import in an HTML block, not one after a blank line or in a fence", () => {
    assert.equal(findHiddenImports("<div>\n@a.md\n").length, 1);
    assert.equal(findHiddenImports("<div>\n\n@a.md\n").length, 0);
    assert.equal(findHiddenImports("```\n<div>\n@a.md\n```\n").length, 0);
  });
});
