/**
 * An instructing document is read by an agent about to change this codebase, so a path that
 * moved sends the next change to a directory that is no longer there. Only prose is checked:
 * a fenced block is where these documents show invented examples.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, expectRatchet } from "./helpers.js";

const FENCED_BLOCK = /```[\s\S]*?```/g;

/**
 * A citation is rooted at the package (`src/…`, `tests/…`) or written relative to `src/`,
 * naming a top-level area directly (`shared/…`, `contexts/…`). A bare
 * `application/` or `domain/` prefix is deliberately not matched: `application/json` is a
 * media type and `domain/ports` names a fragment, so a wider regex reports more noise than
 * drift. A name that continues a longer path (`application/shared/x.ts`) is that path's own
 * segment, not an area.
 */
const CITED_PATH =
  /\b(?:src|tests)\/[A-Za-z0-9_./-]+|\b(?:kernel|contexts|presentation|runtime)\/[A-Za-z0-9_./-]+|(?<!\/)\bshared\/[A-Za-z0-9_./-]+/g;

/** `src/`-relative citations resolve under `src/`; rooted ones resolve as written. */
function resolveCitation(cited: string): string {
  return cited.startsWith("src/") || cited.startsWith("tests/") ? cited : `src/${cited}`;
}

/** Paths cited in prose that no longer exist. This list may only shrink. */
const BASELINE: string[] = [];

/**
 * Where a cited path is an instruction rather than a record. `aidd_docs/tasks/` is absent on
 * purpose: a finished plan describing the tree as it was is a record, and holding it true
 * would forbid ever moving a file.
 */
const INSTRUCTING_SOURCES: readonly string[] = [
  ".claude/rules",
  ".claude/skills",
  "aidd_docs/memory",
  "aidd_docs/GUIDELINES.md",
  "ARCHITECTURE.md",
  "README.md",
  "vitest.config.ts",
  "knip.json",
  "tsup.config.ts",
  "stryker.conf.json",
];

function instructingFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(full);
    }
  };
  for (const source of INSTRUCTING_SOURCES) {
    const full = join(CLI_ROOT, source);
    if (statSync(full).isDirectory()) walk(full);
    else out.push(full);
  }
  return out;
}

function statable(relativePath: string): boolean {
  try {
    statSync(join(CLI_ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

/** A `.js` specifier is how ESM output names a `.ts` file, so a document citing one names a
 * file that exists. */
function exists(relativePath: string): boolean {
  if (statable(relativePath)) return true;
  return relativePath.endsWith(".js") && statable(relativePath.replace(/\.js$/, ".ts"));
}

/** Every path a document instructs the reader to open, fenced examples excluded. */
function citedInProse(text: string): string[] {
  const prose = text.replace(FENCED_BLOCK, "");
  return (
    [...new Set(prose.match(CITED_PATH) ?? [])]
      // Trailing punctuation belongs to the sentence, not the path: `src/shared/.` and
      // `src/shared/` both name the directory.
      .map((cited) => cited.replace(/[./]+$/, ""))
      .filter((cited) => cited.includes("/"))
  );
}

describe("every document that instructs names paths that exist", () => {
  it("every path an instructing document names is still there", () => {
    const dead = new Set<string>();
    for (const file of instructingFiles()) {
      for (const cited of citedInProse(readFileSync(file, "utf8"))) {
        if (!exists(resolveCitation(cited))) dead.add(cited);
      }
    }

    const { added, fixed } = expectRatchet([...dead].sort(), BASELINE);
    expect(added, "an instructing document names a path that no longer exists").toEqual([]);
    expect(fixed, "fixed — remove these from BASELINE").toEqual([]);
  });
});

describe("the guard itself", () => {
  it("reads instructions and ignores illustrations", () => {
    const text = "Open `src/cli.ts`.\n\n```ts\n// src/domain/models/invented.ts\n```\n";
    expect(citedInProse(text)).toEqual(["src/cli.ts"]);
  });

  it("catches a dead path written the way the skills write it, without the src/ prefix", () => {
    const cited = citedInProse("The primitives live in `contexts/gone.ts`.");

    expect(cited, "a bare top-level area is a citation too").toEqual(["contexts/gone.ts"]);
    expect(resolveCitation("contexts/gone.ts")).toBe("src/contexts/gone.ts");
    expect(exists(resolveCitation("contexts/gone.ts")), "and it is checked, not skipped").toBe(
      false
    );
    expect(exists(resolveCitation("shared/domain/errors.ts")), "a live one still passes").toBe(
      true
    );
  });

  it("reads a shared/ segment of a longer path as part of it, not as an area", () => {
    expect(citedInProse("Through `application/shared/remove-project-hooks.ts`.")).toEqual([]);
  });

  it("checks a path under shared/ like one under contexts/", () => {
    const cited = citedInProse("The port lives in `shared/gone.ts`.");

    expect(cited).toEqual(["shared/gone.ts"]);
    expect(exists(resolveCitation("shared/gone.ts"))).toBe(false);
  });
});
