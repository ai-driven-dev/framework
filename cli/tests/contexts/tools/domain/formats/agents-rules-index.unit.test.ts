import { describe, expect, it } from "vitest";
import {
  addAgentsRulesGlob,
  agentsIndexFiles,
  removeAgentsRulesGlob,
} from "../../../../../src/contexts/tools/domain/formats/agents-rules-index.js";

const GLOB = ".kimi-code/instructions/aidd-dev-*.md";
const OTHER = ".kimi-code/instructions/aidd-pm-*.md";
const START = "<!-- aidd_plugin_rules:start -->";
const END = "<!-- aidd_plugin_rules:end -->";
const PERSON = "# Project\n\nKept as written.\n";
const GENERATOR_BLOCK =
  "<!-- aidd_rules:start -->\nBefore editing a file, read each rule whose scope matches it.\n\n- all files: [Naming](aidd_docs/rules/naming.md)\n<!-- aidd_rules:end -->\n";

const globsOf = (text: string): string[] =>
  [...text.matchAll(/^- `(.+)`$/gm)].map((match) => match[1]);

describe("listing a plugin's rules glob in AGENTS.md", () => {
  it("creates the file's one marked block when there is no file", () => {
    const text = addAgentsRulesGlob(null, GLOB);

    expect(text.startsWith(`${START}\n`)).toBe(true);
    expect(text.endsWith(`${END}\n`)).toBe(true);
    expect(globsOf(text)).toStrictEqual([GLOB]);
  });

  it("appends the block after what a person wrote, which stays byte for byte", () => {
    const text = addAgentsRulesGlob(PERSON, GLOB);

    expect(text.startsWith(`${PERSON}\n${START}`)).toBe(true);
    expect(globsOf(text)).toStrictEqual([GLOB]);
  });

  it("separates the block from a last line that has no line feed", () => {
    const text = addAgentsRulesGlob("# Project", GLOB);

    expect(text.startsWith(`# Project\n\n${START}`)).toBe(true);
  });

  it("joins a second plugin to the same block and keeps the text around it", () => {
    const first = addAgentsRulesGlob(`${PERSON}`, GLOB);
    const text = addAgentsRulesGlob(`${first}\n## After\n`, OTHER);

    expect(globsOf(text)).toStrictEqual([GLOB, OTHER]);
    expect(text.split(START)).toHaveLength(2);
    expect(text.startsWith(PERSON)).toBe(true);
    expect(text.endsWith("\n## After\n")).toBe(true);
  });

  it("answers the text as it is when the glob is already listed", () => {
    const listed = addAgentsRulesGlob(PERSON, GLOB);

    expect(addAgentsRulesGlob(listed, GLOB)).toBe(listed);
  });

  it("leaves the generator's own index block alone", () => {
    const text = addAgentsRulesGlob(`${PERSON}\n${GENERATOR_BLOCK}`, GLOB);

    expect(text.startsWith(`${PERSON}\n${GENERATOR_BLOCK}`)).toBe(true);
    expect(globsOf(text)).toStrictEqual([GLOB]);
  });

  it("refuses a block whose markers do not pair, so the person repairs it", () => {
    const broken = `${PERSON}\n${START}\nhand edit\n`;
    const twice = `${START}\n- \`${OTHER}\`\n${START}\n${END}\n`;

    expect(() => addAgentsRulesGlob(broken, GLOB)).toThrow(/AGENTS\.md.*repair/);
    expect(() => addAgentsRulesGlob(twice, GLOB)).toThrow(/AGENTS\.md.*repair/);
  });

  it("does not take a marker quoted inside a line for a block", () => {
    const quoted = `${PERSON}\nThe block opens with \`${START}\` and ends with ${END} in a line.\nIt starts at ${START}\n`;
    const text = addAgentsRulesGlob(quoted, GLOB);

    expect(text.startsWith(`${quoted}\n${START}\n`)).toBe(true);
    expect(globsOf(text)).toStrictEqual([GLOB]);
  });

  it("tells the model that a rule stating no files applies to every file", () => {
    expect(addAgentsRulesGlob(null, GLOB)).toContain("any other rule applies to every file");
  });
});

describe("taking a plugin's rules glob out of AGENTS.md", () => {
  it("takes only its glob out and keeps the other plugin's", () => {
    const both = addAgentsRulesGlob(addAgentsRulesGlob(PERSON, GLOB), OTHER);
    const text = removeAgentsRulesGlob(both, GLOB);

    expect(globsOf(text)).toStrictEqual([OTHER]);
    expect(text.startsWith(PERSON)).toBe(true);
  });

  it("takes the whole block out with its last glob and gives the person's text back", () => {
    expect(removeAgentsRulesGlob(addAgentsRulesGlob(PERSON, GLOB), GLOB)).toBe(PERSON);
    expect(removeAgentsRulesGlob(addAgentsRulesGlob(null, GLOB), GLOB)).toBe("");
  });

  it("answers the text as it is when the glob is not listed or the markers do not pair", () => {
    const listed = addAgentsRulesGlob(PERSON, OTHER);
    const broken = `${PERSON}\n${START}\n- \`${GLOB}\`\n`;

    expect(removeAgentsRulesGlob(listed, GLOB)).toBe(listed);
    expect(removeAgentsRulesGlob(broken, GLOB)).toBe(broken);
    expect(removeAgentsRulesGlob(PERSON, GLOB)).toBe(PERSON);
  });

  it("leaves a block a person edited alone when its glob is not listed", () => {
    const edited = `${START}\nmy own words\n\n- \`${OTHER}\`\n${END}\n`;

    expect(removeAgentsRulesGlob(edited, GLOB)).toBe(edited);
  });
});

describe("the AGENTS.md a build writes for the rules its plugins placed", () => {
  it("lists each plugin's glob after the file the output already holds", () => {
    const files = agentsIndexFiles(new Map([["AGENTS.md", PERSON]]), [GLOB, OTHER]);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("AGENTS.md");
    expect(files[0].content.startsWith(PERSON)).toBe(true);
    expect(globsOf(files[0].content)).toStrictEqual([GLOB, OTHER]);
  });

  it("writes no file when no plugin placed a rule", () => {
    expect(agentsIndexFiles(new Map([["AGENTS.md", PERSON]]), [])).toStrictEqual([]);
  });
});
