/**
 * A deviation with no condition that ends it is a decision nobody can revisit. Every row of the
 * Exceptions and Migration state tables of the reference context says when it closes; a
 * deliberate permanence says "none" and why, it does not leave the cell empty.
 */
import { describe, expect, it } from "vitest";
import { read } from "./helpers.js";

const REFERENCE_CONTEXT = ".claude/rules/cli-contexts/reference-context.md";
const TABLES = ["Exceptions", "Migration state"];

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

function tableLines(markdown: string, title: string): string[] {
  const section = new RegExp(`^### ${title}\\n([\\s\\S]*?)(?=^#{2,3} |(?![\\s\\S]))`, "m").exec(
    markdown
  )?.[1];
  return (section ?? "").split("\n").filter((line) => line.startsWith("|"));
}

/** The rows of the table under `### <title>`, header and divider excluded. */
function rowsUnder(markdown: string, title: string): string[][] {
  return tableLines(markdown, title).slice(2).map(cells);
}

/** The last column is the one `withoutClosing` reads, so its header must say so. */
function lastHeader(markdown: string, title: string): string | undefined {
  return cells(tableLines(markdown, title)[0] ?? "").at(-1);
}

/** Rows whose last column, the closing condition, is empty. */
function withoutClosing(markdown: string): string[] {
  return TABLES.flatMap((title) =>
    rowsUnder(markdown, title)
      .filter((row) => row[row.length - 1] === "")
      .map((row) => `${title}: ${row[0]}`)
  );
}

describe("every deviation names when it closes", () => {
  it("every exception and migration row has a closing condition", () => {
    const markdown = read(REFERENCE_CONTEXT);

    for (const title of TABLES) {
      expect(rowsUnder(markdown, title).length, `${title} table is read`).toBeGreaterThan(0);
      expect(lastHeader(markdown, title), `${title} last column`).toBe("Closes when");
    }
    expect(withoutClosing(markdown), "a row with an empty closes-when cell").toEqual([]);
  });
});

describe("the guard itself", () => {
  const table = (...rows: string[]) =>
    ["### Exceptions", "| Deviation | Why | Closes when |", "| --- | --- | --- |", ...rows].join(
      "\n"
    );

  it("names a row whose closes-when cell is empty", () => {
    expect(withoutClosing(table("| a | because |  |", "| b | because | when c |"))).toEqual([
      "Exceptions: a",
    ]);
  });

  it("reads the header of the last column", () => {
    expect(lastHeader(table(), "Exceptions")).toBe("Closes when");
    expect(lastHeader(table().replace("Closes when", "Why not"), "Exceptions")).toBe("Why not");
  });

  it("reads an escaped pipe as part of its cell", () => {
    expect(withoutClosing(table("| a \\| b | because | when c |"))).toEqual([]);
  });
});
