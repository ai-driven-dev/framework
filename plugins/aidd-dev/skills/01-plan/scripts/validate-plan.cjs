#!/usr/bin/env node
// Usage, from the project root: node validate-plan.cjs <feature-folder>
// The templates in ../assets are the contract: sections, order, table headers, front matter.
const fs = require("node:fs");
const path = require("node:path");

const SKILL_DIR = path.join(__dirname, "..");
const ASSETS_DIR = path.join(SKILL_DIR, "assets");
const PLAN_FILE = "plan.md";
const PLAN_TEMPLATE = "plan-template.md";
const PHASE_TEMPLATE = "phase-template.md";

const SECTION_PHASES = "Phases";
const SECTION_EXTERNAL_SOURCES = "External sources";
const SECTION_PROJECTION = "Architecture projection";
const SECTION_WIREFRAME = "Wireframe";
const SECTION_ACCEPTANCE = "Test acceptance criteria";

const NO_DEPENDENCY = "none";
const PHASE_ROW_MIN_CELLS = 4; // number, name, file, Depends on
const FIRST_PHASE_NUMBER = 1;
const URL_MARKER = "http";
const ROW_PREVIEW_LENGTH = 40;
const TITLE_LEVEL = "#";
const PLACEHOLDER_OPENER = "{{";
const CODE_FENCE = "```";
const LINE_BREAK = "\n";
const TABLE_CELL_SEPARATOR = "|";
const PATH_SEPARATOR = "/";

const VERDICT_VALID = "VALID";
const VERDICT_INVALID = "INVALID";
const EXIT_VALID = 0;
const EXIT_INVALID = 1;

const MODIFY_MARK = "✏";
const DELETE_MARK = "❌";
const TREE_MARKS = /✅|✏|❌/;
const TREE_MARKS_AND_SELECTOR = /[✅✏❌️]/gu;
const TREE_LINE = /^([\s│├└─|]*)(\S+)/u;
const PLAIN_PATH = /^[\w@./-]+$/;
const CURRENT_FOLDER = ".";

const WINDOWS_LINE_ENDING = /\r\n/g;
const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/;
const FRONT_MATTER_ENTRY = /^(\w+):\s*(.*)$/;
const DOUBLE_QUOTES = /^"|"$/g;
const HEADING = /^(#{1,2}) (.*)$/;
const WHITESPACE_RUN = /\s+/g;
const TABLE_SEPARATOR = /^\|[\s:|-]+\|$/;
const TABLE_HEADER_URL = /^\|\s*URL\b/;
const TABLE_ROW_NONE = /^\|\s*`?none/i;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const HTML_COMMENT_OPENER = /<!--/;
const OMIT_HINT = /omit/i;
const PLACEHOLDER = /\{\{[^}]*\}\}/;
const CODE_BLOCKS = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`\n]*`/g;
const FENCED_BLOCK_BODY = /```[^\n]*\n([\s\S]*?)```/;
const LISTED_PHASE_ROW = /^\|\s*\d+\s*\|/gm;
const DIGITS = /^\d+$/;
const BACKTICKS = /`/g;
const LIST_SEPARATOR = /\s*,\s*/;
const REPEATED_SLASHES = /\/+/g;
const TRAILING_SLASH = /\/$/;
const PHASE_FILE = /^phase-\d+\.md$/;
const FIRST_NUMBER = /\d+/;
const WIREFRAME_REGION = /\(1\)/;
const WIREFRAME_LEGEND = /^1\. /m;
const TASK_HEADING = /^###\s*`?(\d+)\)/gm;
const ACCEPTANCE_ROW = /^\|\s*(\d+)\s*\|/gm;

const phaseFileName = (number) => `phase-${number}.md`;
const normalize = (text) => text.replace(WHITESPACE_RUN, " ").trim();
const readMarkdown = (file) => fs.readFileSync(file, "utf8").replace(WINDOWS_LINE_ENDING, LINE_BREAK);
const readAsset = (name) => readMarkdown(path.join(ASSETS_DIR, name));
const tableCells = (line) => line.split(TABLE_CELL_SEPARATOR).slice(1, -1).map(normalize);
const findSection = (doc, name) => doc.sections.find((section) => section.name === name);

function parseFrontMatter(text) {
  const entries = text.split(LINE_BREAK).map((line) => line.match(FRONT_MATTER_ENTRY)).filter(Boolean);
  return Object.fromEntries(entries.map(([, key, value]) => [key, value.replace(DOUBLE_QUOTES, "")]));
}

function splitSections(lines) {
  const start = { title: "", sections: [], insideFence: false };
  return lines.reduce((state, line) => {
    const insideFence = line.startsWith(CODE_FENCE) ? !state.insideFence : state.insideFence;
    const heading = insideFence ? null : line.match(HEADING);
    if (heading?.[1] === TITLE_LEVEL) return { ...state, insideFence, title: state.title || line };
    if (heading) return { ...state, insideFence, sections: [...state.sections, { name: normalize(heading[2]), body: "" }] };
    const current = state.sections.at(-1);
    if (!current) return { ...state, insideFence };
    const grown = { ...current, body: `${current.body}${line}${LINE_BREAK}` };
    return { ...state, insideFence, sections: [...state.sections.slice(0, -1), grown] };
  }, start);
}

function parseDocument(markdown) {
  const head = markdown.match(FRONT_MATTER);
  const body = head ? markdown.slice(head[0].length) : markdown;
  const { title, sections } = splitSections(body.split(LINE_BREAK));
  return { frontMatter: parseFrontMatter(head ? head[1] : ""), title, sections };
}

function tableHeaders(body) {
  const lines = body.split(LINE_BREAK);
  return lines
    .filter((line, index) => line.startsWith(TABLE_CELL_SEPARATOR) && TABLE_SEPARATOR.test(lines[index + 1] ?? ""))
    .map((line) => tableCells(line).join(TABLE_CELL_SEPARATOR));
}

const isOptional = (body) => (body.match(HTML_COMMENT) ?? []).some((comment) => OMIT_HINT.test(comment));

function frontMatterProblems(file, actual, expected) {
  const fromTemplate = Object.entries(expected).flatMap(([key, value]) => {
    if (!(key in actual)) return [`${file}: front matter key "${key}" missing`];
    const isPlaceholder = value.includes(PLACEHOLDER_OPENER);
    if (!isPlaceholder && actual[key] !== value) return [`${file}: front matter "${key}" must be "${value}"`];
    if (isPlaceholder && !actual[key].trim()) return [`${file}: front matter "${key}" empty`];
    return [];
  });
  const foreign = Object.keys(actual).filter((key) => !(key in expected));
  return [...fromTemplate, ...foreign.map((key) => `${file}: front matter key "${key}" is not in the template`)];
}

function titleProblems(file, actual, expected) {
  const prefix = expected.split(PLACEHOLDER_OPENER)[0].trim();
  return actual.startsWith(prefix) ? [] : [`${file}: title must start with "${prefix}"`];
}

function sectionOrderProblems(file, sections, templateSections) {
  const known = templateSections.map((section) => section.name);
  const { problems } = sections.reduce(
    ({ last, problems }, section) => {
      const index = known.indexOf(section.name);
      if (index < 0) return { last, problems: [...problems, `${file}: section "${section.name}" is not in the template`] };
      if (index < last) return { last, problems: [...problems, `${file}: section "${section.name}" is out of order`] };
      return { last: index, problems };
    },
    { last: -1, problems: [] }
  );
  return problems;
}

function missingSectionProblems(file, doc, templateSections) {
  return templateSections.flatMap((expected) => {
    const actual = findSection(doc, expected.name);
    if (!actual) return isOptional(expected.body) ? [] : [`${file}: section "${expected.name}" missing`];
    const present = tableHeaders(actual.body);
    return tableHeaders(expected.body)
      .filter((header) => !present.includes(header))
      .map(() => `${file}: section "${expected.name}": table header differs from the template`);
  });
}

function matchTemplate(file, markdown, template) {
  const doc = parseDocument(markdown);
  const prose = markdown.replace(CODE_BLOCKS, "").replace(INLINE_CODE, "");
  const problems = [
    ...(HTML_COMMENT_OPENER.test(markdown) ? [`${file}: comment left, delete every comment`] : []),
    ...(PLACEHOLDER.test(prose) ? [`${file}: placeholder {{...}} left, fill it or omit its section`] : []),
    ...frontMatterProblems(file, doc.frontMatter, template.frontMatter),
    ...titleProblems(file, doc.title, template.title),
    ...sectionOrderProblems(file, doc.sections, template.sections),
    ...missingSectionProblems(file, doc, template.sections),
  ];
  return { doc, problems };
}

function projectedFiles(file, body) {
  const block = (body.match(FENCED_BLOCK_BODY) ?? [, ""])[1];
  const start = { folders: [], problems: [] };
  const { problems } = block.split(LINE_BREAK).reduce((state, raw) => {
    const mark = (raw.match(TREE_MARKS) ?? [""])[0];
    const line = raw.replace(TREE_MARKS_AND_SELECTOR, " ").match(TREE_LINE);
    if (!line || line[2] === CURRENT_FOLDER || !PLAIN_PATH.test(line[2])) return state;
    const [, indent, name] = line;
    const parents = state.folders.filter((folder) => folder.indent < indent.length);
    const relative = [...parents.map((folder) => folder.name), name].join(PATH_SEPARATOR).replace(REPEATED_SLASHES, PATH_SEPARATOR);
    const isFolder = name.endsWith(PATH_SEPARATOR);
    const folders = isFolder ? [...parents, { indent: indent.length, name: name.replace(TRAILING_SLASH, "") }] : parents;
    const needsExisting = mark === MODIFY_MARK || mark === DELETE_MARK;
    const missing = needsExisting && !fs.existsSync(path.resolve(relative));
    const action = mark === MODIFY_MARK ? "modify" : "delete";
    return {
      folders,
      problems: missing ? [...state.problems, `${file}: ${relative} is marked ${action} but does not exist`] : state.problems,
    };
  }, start);
  return { problems };
}

function phaseRows(plan) {
  const body = findSection(plan, SECTION_PHASES)?.body ?? "";
  return body
    .split(LINE_BREAK)
    .map(tableCells)
    .filter((cells) => DIGITS.test(cells[0] ?? "") && cells.length >= PHASE_ROW_MIN_CELLS);
}

const dependencyCell = (cells) => cells.at(-1).replace(BACKTICKS, "");

function dependencyProblems(rows) {
  return rows
    .filter((cells) => {
      const cell = dependencyCell(cells);
      return cell !== NO_DEPENDENCY && !cell.split(LIST_SEPARATOR).every((part) => DIGITS.test(part) && Number(part) < Number(cells[0]));
    })
    .map((cells) => `${PLAN_FILE}: phase ${cells[0]} "Depends on" must be "${NO_DEPENDENCY}" or earlier phase numbers`);
}

function phaseFileProblems(folder, listed) {
  const numbers = Array.from({ length: listed }, (_, index) => FIRST_PHASE_NUMBER + index);
  const missing = numbers
    .filter((number) => !fs.existsSync(path.join(folder, phaseFileName(number))))
    .map((number) => `${phaseFileName(number)}: listed in ${PLAN_FILE}, file missing`);
  const unlisted = fs
    .readdirSync(folder)
    .filter((name) => PHASE_FILE.test(name) && Number.parseInt(name.match(FIRST_NUMBER)[0], 10) > listed)
    .map((name) => `${name}: not listed in ${PLAN_FILE}`);
  return [...missing, ...unlisted];
}

function externalSourceProblems(plan) {
  const lines = (findSection(plan, SECTION_EXTERNAL_SOURCES)?.body ?? "").split(LINE_BREAK);
  const rows = lines.filter((line) => line.startsWith(TABLE_CELL_SEPARATOR) && !TABLE_SEPARATOR.test(line) && !TABLE_HEADER_URL.test(line) && !TABLE_ROW_NONE.test(line));
  return rows
    .filter((row) => !row.includes(URL_MARKER))
    .map((row) => `${PLAN_FILE}: ${SECTION_EXTERNAL_SOURCES} row without a URL: ${row.slice(0, ROW_PREVIEW_LENGTH)}`);
}

function wireframeProblems(file, doc) {
  const frame = findSection(doc, SECTION_WIREFRAME)?.body;
  const drawn = frame !== undefined && WIREFRAME_REGION.test(frame) && WIREFRAME_LEGEND.test(frame);
  return frame === undefined || drawn ? [] : [`${file}: section "${SECTION_WIREFRAME}" needs a frame with region (1) and a legend "1. ...", or omit the section`];
}

function taskProblems(file, markdown, doc) {
  const tasks = new Set([...markdown.matchAll(TASK_HEADING)].map((match) => match[1]));
  const numbers = [...tasks].map(Number).sort((a, b) => a - b);
  const gap = numbers.some((number, index) => number !== FIRST_PHASE_NUMBER + index);
  const acceptanceRows = [...(findSection(doc, SECTION_ACCEPTANCE)?.body ?? "").matchAll(ACCEPTANCE_ROW)];
  return [
    ...(gap ? [`${file}: task numbers must run ${FIRST_PHASE_NUMBER} to ${numbers.length} with no gap`] : []),
    ...acceptanceRows.filter((row) => !tasks.has(row[1])).map((row) => `${file}: acceptance row ${row[1]} maps to no task`),
  ];
}

function phaseProblems(folder, number, phaseTemplate) {
  const file = phaseFileName(number);
  const fullPath = path.join(folder, file);
  if (!fs.existsSync(fullPath)) return [];
  const markdown = readMarkdown(fullPath);
  const { doc, problems: templateIssues } = matchTemplate(file, markdown, phaseTemplate);
  const projection = projectedFiles(file, findSection(doc, SECTION_PROJECTION)?.body ?? "");
  return [...templateIssues, ...projection.problems, ...wireframeProblems(file, doc), ...taskProblems(file, markdown, doc)];
}

function planProblems(folder) {
  const skillRelative = path.relative(SKILL_DIR, fs.realpathSync(folder));
  const insideSkill = !skillRelative.startsWith("..") && !path.isAbsolute(skillRelative);
  const planTemplate = parseTemplate(PLAN_TEMPLATE);
  const phaseTemplate = parseTemplate(PHASE_TEMPLATE);
  const { doc: plan, problems: planTemplateIssues } = matchTemplate(PLAN_FILE, readMarkdown(path.join(folder, PLAN_FILE)), planTemplate);

  const phasesBody = findSection(plan, SECTION_PHASES)?.body ?? "";
  const listed = (phasesBody.match(LISTED_PHASE_ROW) ?? []).length;
  const rows = phaseRows(plan);
  const numbers = Array.from({ length: listed }, (_, index) => FIRST_PHASE_NUMBER + index);
  const phases = numbers.map((number) => phaseProblems(folder, number, phaseTemplate));

  return [
    ...(insideSkill ? [`${folder}: folder is inside the skill itself, write the plan in the project`] : []),
    ...planTemplateIssues,
    ...(listed ? [] : [`${PLAN_FILE}: no row in ## ${SECTION_PHASES}`]),
    ...dependencyProblems(rows),
    ...phaseFileProblems(folder, listed),
    ...externalSourceProblems(plan),
    ...phases.flat(),
  ];
}

function parseTemplate(name) {
  const { frontMatter, title, sections } = parseDocument(readAsset(name));
  return { frontMatter, title, sections };
}

function finish(problems) {
  console.log([problems.length ? VERDICT_INVALID : VERDICT_VALID, ...problems].join(LINE_BREAK));
  process.exit(problems.length ? EXIT_INVALID : EXIT_VALID);
}

function main(folder) {
  const planPath = path.join(folder ?? "", PLAN_FILE);
  if (!folder || !fs.existsSync(planPath)) finish([`${planPath}: missing, write the plan files first`]);
  finish(planProblems(folder));
}

main(process.argv[2]);
