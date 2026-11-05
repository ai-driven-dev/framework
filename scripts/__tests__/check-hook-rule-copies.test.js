const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { differingCopies, hostAdapterCopies, run } = require("../check-hook-rule-copies.js");

const COPY = (plugin) => ["plugins", plugin, "hooks", "lib", "common-rules.cjs"].join("/");

/** A throwaway tree holding one copy per plugin, removed after `body` runs. */
function inTree(copies, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hook-rule-copies-"));
  try {
    for (const [plugin, text] of Object.entries(copies)) {
      const full = path.join(root, COPY(plugin));
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, text);
    }
    return body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const quiet = () => {};

function logged(root) {
  const lines = [];
  const status = run(root, (line) => lines.push(line), quiet);
  return { status, text: lines.join("\n") };
}

test("one copy passes", () => {
  inTree({ "aidd-context": "module.exports = {};\n" }, (root) => {
    assert.deepEqual(differingCopies(root).differing, []);
    assert.equal(run(root, quiet, quiet), 0);
  });
});

test("identical copies pass", () => {
  inTree({ "aidd-context": "same\n", "aidd-ui": "same\n" }, (root) => {
    assert.equal(run(root, quiet, quiet), 0);
  });
});

test("the copy that left the majority is named, even when it sorts first", () => {
  inTree({ "aidd-a": "samf\n", "aidd-b": "same\n", "aidd-c": "same\n" }, (root) => {
    assert.deepEqual(differingCopies(root).differing, [COPY("aidd-a")]);
    const { status, text } = logged(root);
    assert.equal(status, 1);
    assert.match(text, /plugins\/aidd-a\/hooks\/lib\/common-rules\.cjs/u);
  });
});

test("a tie names every copy, and every copy is listed with a short hash", () => {
  inTree({ "aidd-context": "same\n", "aidd-ui": "samf\n" }, (root) => {
    assert.deepEqual(differingCopies(root).differing, [COPY("aidd-context"), COPY("aidd-ui")]);
    const { status, text } = logged(root);
    assert.equal(status, 1);
    for (const plugin of ["aidd-context", "aidd-ui"]) assert.match(text, new RegExp(`${COPY(plugin)} [0-9a-f]{8}`, "u"));
    assert.match(text, /make every copy identical, then rerun/u);
  });
});

test("copies differing only in their last byte are told apart", () => {
  const body = "x".repeat(1000);
  inTree({ "aidd-a": `${body}a`, "aidd-b": `${body}a`, "aidd-c": `${body}b` }, (root) => {
    assert.deepEqual(differingCopies(root).differing, [COPY("aidd-c")]);
  });
});

test("a plugin without the library is not a copy", () => {
  inTree({ "aidd-context": "same\n" }, (root) => {
    fs.mkdirSync(path.join(root, "plugins", "aidd-pm", "hooks"), { recursive: true });
    assert.equal(differingCopies(root).copies.length, 1);
  });
});

const ADAPTER = ["cli", "assets", "hooks-runtime", "host-claude.cjs"].join("/");
const HOST = (plugin) => ["plugins", plugin, "hooks", "lib", "host.cjs"].join("/");
const MANIFEST = (plugin) => ["plugins", plugin, "hooks", "hooks.json"].join("/");

/** A throwaway tree holding the given files, removed after `body` runs. */
function withFiles(files, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hook-rule-copies-"));
  try {
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    }
    return body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("every plugin that ships hooks carries the Claude Code host adapter, byte for byte", () => {
  const files = { [ADAPTER]: "adapter\n", [MANIFEST("aidd-a")]: "{}", [HOST("aidd-a")]: "adapter\n" };
  withFiles(files, (root) => {
    assert.deepEqual(hostAdapterCopies(root), { copies: [HOST("aidd-a")], differing: [], missing: [] });
    assert.equal(run(root, quiet, quiet), 0);
  });
});

test("a copy that differs from the asset is named, even when every copy agrees", () => {
  const files = {
    [ADAPTER]: "adapter\n",
    [MANIFEST("aidd-a")]: "{}",
    [HOST("aidd-a")]: "adapted\n",
    [MANIFEST("aidd-b")]: "{}",
    [HOST("aidd-b")]: "adapted\n",
  };
  withFiles(files, (root) => {
    assert.deepEqual(hostAdapterCopies(root).differing, [HOST("aidd-a"), HOST("aidd-b")]);
    const { status, text } = logged(root);
    assert.equal(status, 1);
    assert.match(text, /plugins\/aidd-a\/hooks\/lib\/host\.cjs differs from cli\/assets\/hooks-runtime\/host-claude\.cjs/u);
  });
});

test("a plugin that ships hooks without the adapter is named", () => {
  withFiles({ [ADAPTER]: "adapter\n", [MANIFEST("aidd-a")]: "{}" }, (root) => {
    assert.deepEqual(hostAdapterCopies(root).missing, [HOST("aidd-a")]);
    const { status, text } = logged(root);
    assert.equal(status, 1);
    assert.match(text, /plugins\/aidd-a\/hooks\/lib\/host\.cjs is missing/u);
  });
});

test("a plugin that ships no hooks needs no adapter", () => {
  withFiles({ [ADAPTER]: "adapter\n", "plugins/aidd-a/skills/x/SKILL.md": "x" }, (root) => {
    assert.deepEqual(hostAdapterCopies(root), { copies: [], differing: [], missing: [] });
  });
});

test("without the asset, every copy is named, so none is trusted", () => {
  withFiles({ [MANIFEST("aidd-a")]: "{}", [HOST("aidd-a")]: "adapter\n" }, (root) => {
    assert.deepEqual(hostAdapterCopies(root).differing, [HOST("aidd-a")]);
  });
});

test("this repository's copies are identical", () => {
  assert.equal(run(path.resolve(__dirname, "../.."), quiet, quiet), 0);
});
