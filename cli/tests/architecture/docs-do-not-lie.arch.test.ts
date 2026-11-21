/**
 * A reader cannot tell a promised command or a promised directory from a real one; this test can.
 *
 * Commands: naming a command in order to say it is gone is not a lie, so a citation is accepted
 * when its line marks it removed or is a migration row - which keeps the check honest without a
 * name allowlist.
 *
 * Map: `codebase-map.md` is the single place that says where things live, and a map maintained by
 * hand drifts both ways. The comparison is over full paths reconstructed from the tree block's
 * indentation - comparing names alone reads `application/` as present wherever it exists - and
 * it runs in both directions: an invented directory sends a reader to create a file there.
 */
import { describe, expect, it } from "vitest";
import { present } from "../shared/testing/present.builder.js";
import {
  declaredCommands,
  pluginReadmes,
  read,
  readFromRepoRoot,
  sourceFiles,
  unresolvedCommandMentions,
} from "./source-graph.js";

/** Documents that present the CLI's surface to a reader - the memory bank included, since an
 * agent reads it first in every session. */
const DOCS = [
  "ARCHITECTURE.md",
  "README.md",
  "aidd_docs/memory/codebase-map.md",
  "aidd_docs/memory/project-brief.md",
];

/** The line itself says the command is gone. */
const MARKED_GONE = /\b(removed|legacy|no longer|deprecated|replaced by)\b|there is no/i;

/** A table row naming two commands maps an old one to its replacement. */
function isMigrationRow(line: string): boolean {
  return line.trimStart().startsWith("|") && [...line.matchAll(/\baidd\s+[a-z]/g)].length >= 2;
}

/**
 * `MARKED_GONE` is checked against a whole paragraph unwrapped to one line: markdown wraps
 * prose, so a citation and the word marking it gone can land on different physical lines. A
 * migration row is still read one line at a time, a table having no blank line to unwrap at.
 */
function textClaimingCommandsWork(text: string): string {
  const paragraphs = text.split(/\n\s*\n/);
  const kept: string[] = [];
  for (const paragraph of paragraphs) {
    if (MARKED_GONE.test(paragraph.replace(/\n/g, " "))) continue;
    kept.push(
      paragraph
        .split("\n")
        .filter((line) => !isMigrationRow(line))
        .join("\n")
    );
  }
  return kept.join("\n\n");
}

function undeclaredCommands(text: string, declared: ReadonlySet<string>): string[] {
  return [...new Set(unresolvedCommandMentions(textClaimingCommandsWork(text), declared))].sort();
}

describe("documented commands exist", () => {
  const declared = declaredCommands();

  it.each(DOCS)("%s presents no command the CLI does not declare", (doc) => {
    const missing = undeclaredCommands(read(doc), declared);
    expect(missing, `${doc} presents commands that do not exist`).toEqual([]);
  });

  it.each(pluginReadmes())("%s presents no command the CLI does not declare", (doc) => {
    const missing = undeclaredCommands(readFromRepoRoot(doc), declared);
    expect(missing, `${doc} presents commands that do not exist`).toEqual([]);
  });
});

describe("the command guard itself", () => {
  it("flags an undeclared command, a bad pair, and clears one marked gone, migrated, or registered", () => {
    const knownCommands = new Set(["init", "plugin", "plugin install"]);

    expect(undeclaredCommands("Run `aidd bogus-command` to do it.", knownCommands)).toEqual([
      "bogus-command",
    ]);
    // `plugin` exists; `plugin bogus` does not, and reading only the first word clears it.
    expect(undeclaredCommands("Run `aidd plugin bogus` to do it.", knownCommands)).toEqual([
      "plugin bogus",
    ]);
    expect(undeclaredCommands("`aidd bogus-command` was removed.", knownCommands)).toEqual([]);
    expect(undeclaredCommands("| `aidd old-name` | `aidd new-name` |", knownCommands)).toEqual([]);
    expect(undeclaredCommands("Run `aidd init` to start.", knownCommands)).toEqual([]);
    expect(undeclaredCommands("Run `aidd plugin install` to add one.", knownCommands)).toEqual([]);
  });
});

const MAP = "aidd_docs/memory/codebase-map.md";

/** The fenced block whose first line is `src/`. */
function sourceTreeBlock(text: string): string {
  for (const match of text.matchAll(/```[a-z]*\n([\s\S]*?)```/g)) {
    const body = present(match[1]);
    if (body.trimStart().startsWith("src/")) return body;
  }
  throw new Error(`${MAP} has no fenced block drawing the source tree`);
}

/** One tree entry: four prefix characters per level, then a branch marker and a name. */
const TREE_ENTRY = /^([│\s]*)(?:├──|└──)\s+([A-Za-z0-9_.-]+)(\/?)/;
const LEVEL_WIDTH = 4;

function drawnDirectoriesInText(block: string): Set<string> {
  const drawn = new Set<string>();
  const stack: string[] = [];
  for (const line of block.split("\n")) {
    const entry = TREE_ENTRY.exec(line);
    if (entry === null) continue;
    const depth = present(entry[1]).length / LEVEL_WIDTH;
    stack.length = depth;
    stack[depth] = present(entry[2]);
    if (entry[3] === "/") drawn.add(`src/${stack.slice(0, depth + 1).join("/")}`);
  }
  return drawn;
}

function drawnDirectories(): Set<string> {
  return drawnDirectoriesInText(sourceTreeBlock(read(MAP)));
}

function realDirectories(): Set<string> {
  const real = new Set<string>();
  for (const file of sourceFiles()) {
    const segments = file.split("/").slice(0, -1);
    for (let i = 2; i <= segments.length; i += 1) real.add(segments.slice(0, i).join("/"));
  }
  return real;
}

function disagreements(
  real: ReadonlySet<string>,
  drawn: ReadonlySet<string>
): { undocumented: string[]; invented: string[] } {
  return {
    undocumented: [...real].filter((dir) => !drawn.has(dir)).sort(),
    invented: [...drawn].filter((dir) => !real.has(dir)).sort(),
  };
}

describe("the codebase map matches the tree", () => {
  it("draws every directory that holds source, and no directory that does not exist", () => {
    const { undocumented, invented } = disagreements(realDirectories(), drawnDirectories());

    expect(undocumented, `${MAP} is silent about these directories`).toEqual([]);
    expect(invented, `${MAP} draws these directories and they do not exist`).toEqual([]);
  });
});

describe("the map guard itself", () => {
  it("reads a path from the indentation, so the same name under two parents is two paths", () => {
    const block = [
      "src/",
      "├── shared/           # shared vocabulary",
      "└── contexts/         # bounded contexts",
      "    ├── tools/        # what the project targets",
      "    │   └── domain/   # its rules",
      "    └── ghost/        # invented",
    ].join("\n");

    expect(drawnDirectoriesInText(block)).toEqual(
      new Set([
        "src/shared",
        "src/contexts",
        "src/contexts/tools",
        "src/contexts/tools/domain",
        "src/contexts/ghost",
      ])
    );
  });

  it("names a real directory the map omits, an invented one it draws, nothing when they agree", () => {
    const real = new Set(["src/shared", "src/contexts/tools/domain"]);
    const drawn = new Set(["src/shared", "src/contexts/tools/application"]);

    expect(disagreements(real, drawn)).toEqual({
      undocumented: ["src/contexts/tools/domain"],
      invented: ["src/contexts/tools/application"],
    });
    expect(disagreements(real, real)).toEqual({ undocumented: [], invented: [] });
  });
});
