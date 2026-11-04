const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it } = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const CLI_SRC_PREFIX = "cli/src/";
const COLLECTOR = "cli/src/contexts/telemetry/infrastructure/otel/actions/collect.ts";

/**
 * The local OTLP collector is the sole listener in the CLI. This walks every tracked source
 * file under `cli/src` so another listener needs an explicit decision, never an accident.
 * The collector's integration tests verify its loopback bind and required authentication.
 *
 * Deliberately narrow to server construction, not merely importing `node:http` or `node:net`:
 * this codebase makes plenty of outbound calls, and a client is not what this forbids.
 */
const FORBIDDEN_PATTERNS = [
  // No leading `\.`: `createServer` imported by name (`import { createServer } from
  // "node:http"`) and called bare is the same listener as `http.createServer(...)`, and the
  // dotted-only pattern missed it.
  { pattern: /\bcreateServer\s*\(/u, label: "createServer(" },
  // No constraint on the argument: `.listen(process.env.PORT)`, `.listen({ port })` and
  // `.listen(PORT)` (an uppercase identifier) all bind a server, and none starts with a
  // literal "port" or a digit the way `.listen(\s*(?:port|\d)` required.
  { pattern: /\.listen\s*\(/u, label: ".listen(" },
  { pattern: /from ["']node:net["']/u, label: 'import from "node:net"' },
  { pattern: /require\(["']node:net["']\)/u, label: 'require("node:net")' },
];

function trackedCliSourceFiles() {
  const listed = execFileSync("git", ["ls-files", "-z", "--", CLI_SRC_PREFIX], {
    cwd: ROOT,
    encoding: "buffer",
  });
  return listed
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((rel) => rel.endsWith(".ts"));
}

function listenersIn(files) {
  const offenders = [];
  let collectorConstructors = 0;
  let collectorBinds = 0;
  for (const [rel, text] of files) {
    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
      const count = [...text.matchAll(new RegExp(pattern.source, "gu"))].length;
      if (rel === COLLECTOR && label === "createServer(") collectorConstructors = count;
      else if (rel === COLLECTOR && label === ".listen(") collectorBinds = count;
      else if (count > 0) offenders.push(`${rel}: ${label}`);
    }
  }
  return { offenders, collectorConstructors, collectorBinds };
}

describe("the OTLP collector is the only listener in cli/src", () => {
  it("allows one collector server and forbids all other listeners", () => {
    const files = trackedCliSourceFiles();

    // A walk that found nothing would pass this test while checking nothing at all.
    assert.ok(files.length > 300, `expected the CLI's source tree, found ${files.length} files`);
    const { offenders, collectorConstructors, collectorBinds } = listenersIn(
      files.map((rel) => [rel, fs.readFileSync(path.join(ROOT, rel), "utf8")])
    );

    assert.equal(collectorConstructors, 1, "the collector must construct exactly one server");
    assert.equal(collectorBinds, 1, "the collector must bind exactly one listener");
    assert.deepEqual(
      offenders,
      [],
      `only the local OTLP collector may open a listener:\n  ${offenders.join("\n  ")}`
    );
  });

  it("detects a second collector listener or a listener in another source file", () => {
    const collector = "createServer(handler); server.listen(1);";
    const duplicate = listenersIn([[COLLECTOR, `${collector} server.listen(2);`]]);
    assert.equal(duplicate.collectorConstructors, 1);
    assert.equal(duplicate.collectorBinds, 2);
    assert.equal(listenersIn([[COLLECTOR, `${collector} createServer(handler);`]]).collectorConstructors, 2);
    const other = listenersIn([
      [COLLECTOR, collector],
      ["cli/src/cli.ts", "createServer(handler); server.listen(3);"],
    ]);
    assert.deepEqual(other.offenders, ["cli/src/cli.ts: createServer(", "cli/src/cli.ts: .listen("]);
    assert.deepEqual(listenersIn([[COLLECTOR, 'import net from "node:net";']]).offenders, [
      `${COLLECTOR}: import from "node:net"`,
    ]);
  });
});
