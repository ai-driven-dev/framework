/**
 * An exception list is a debt, and a debt nobody wrote down is not one anyone closes. Every
 * tolerated list of `tests/architecture` that holds an entry (found as `baseline-only-shrinks`
 * finds them) is named by a row of the Exceptions or Migration state table of the reference
 * context, with the condition that closes it. The row names the architecture file and the list,
 * so a list with no row, or whose file or name moved, fails here.
 */
import { describe, expect, it } from "vitest";
import { CLI_ROOT, read } from "./helpers.js";
import { filesOnDisk, isToleratedList, listSizes } from "./list-sizes.js";

const REFERENCE_CONTEXT = ".claude/rules/cli-contexts/reference-context.md";
const ROW_TABLES = ["Exceptions", "Migration state"];

type ExceptionList = { readonly file: string; readonly list: string };

/** The lists holding an entry in `files`, by the file's name and the list's. */
function nonEmptyLists(files: Readonly<Record<string, string>>): ExceptionList[] {
  return [...listSizes(files, isToleratedList, { requireReadonly: true })]
    .filter(([, size]) => size === null || size > 0)
    .map(([id]) => {
      const [path = "", list = ""] = id.split("#");
      return { file: path.slice(path.lastIndexOf("/") + 1), list };
    });
}

/** The rows of the tables under `### <title>` for each of `ROW_TABLES`, one string per row. */
function rowsOf(markdown: string): string[] {
  return ROW_TABLES.flatMap((title) => {
    const section = new RegExp(`^### ${title}\\n([\\s\\S]*?)(?=^#{2,3} |(?![\\s\\S]))`, "m").exec(
      markdown
    )?.[1];
    return (section ?? "").split("\n").filter((line) => line.startsWith("|"));
  });
}

const hasRow = (rows: readonly string[], file: string, list: string) =>
  rows.some((row) => row.includes(`\`${file}\``) && row.includes(`\`${list}\``));

/** The lists of `lists` that no row of `markdown` names with their file. */
function listsWithoutRow(markdown: string, lists: readonly ExceptionList[]): string[] {
  const rows = rowsOf(markdown);
  return lists
    .filter(({ file, list }) => !hasRow(rows, file, list))
    .map(({ file, list }) => `${file}#${list}`);
}

describe("every exception list has a row", () => {
  it("names each list holding an entry, with its file, in a row of the reference context", () => {
    const lists = nonEmptyLists(filesOnDisk(CLI_ROOT));

    expect(lists.length).toBeGreaterThan(10);
    expect(listsWithoutRow(read(REFERENCE_CONTEXT), lists)).toEqual([]);
  });
});

describe("the guard itself", () => {
  const table = (...rows: string[]) =>
    ["### Exceptions", "| Deviation | Why | Closes when |", "| --- | --- | --- |", ...rows].join(
      "\n"
    );
  const lists: ExceptionList[] = [
    { file: "a.arch.test.ts", list: "BASELINE" },
    { file: "b.arch.test.ts", list: "BASELINE" },
  ];
  const rowFor = ({ file, list }: ExceptionList) => `| \`${list}\` in \`${file}\` | why | when |`;
  const first = rowFor({ file: "a.arch.test.ts", list: "BASELINE" });
  const second = rowFor({ file: "b.arch.test.ts", list: "BASELINE" });

  it("passes when every list has its row", () => {
    expect(listsWithoutRow(table(first, second), lists)).toEqual([]);
  });

  it("names the one list whose row is missing, telling same-named lists apart by file", () => {
    expect(listsWithoutRow(table(second), lists)).toEqual(["a.arch.test.ts#BASELINE"]);
  });

  it("reads a mention outside the two tables as no row", () => {
    expect(listsWithoutRow(`### Rules\n${first}\n${second}`, lists)).toHaveLength(2);
  });

  it("finds the lists that hold an entry, and a list it cannot size", () => {
    const found = nonEmptyLists({
      "tests/architecture/x.arch.test.ts": [
        'const FULL_BASELINE: readonly string[] = ["a"];',
        "const EMPTY_BASELINE: readonly string[] = [];",
        "const BAD_BASELINE: readonly string[] = [...ROWS];",
        'const OTHER: readonly string[] = ["a"];',
      ].join("\n"),
    });

    expect(found).toEqual([
      { file: "x.arch.test.ts", list: "FULL_BASELINE" },
      { file: "x.arch.test.ts", list: "BAD_BASELINE" },
    ]);
  });
});
