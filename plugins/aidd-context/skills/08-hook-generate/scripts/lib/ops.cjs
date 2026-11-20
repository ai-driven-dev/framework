"use strict";
// The closed set of generic checks. Each op reads one file view and returns findings; no op knows an artifact kind.
const fs = require("node:fs");
const path = require("node:path");
const { headings, sectionOf, fenceMask, readText, frontmatter, proseLines } = require("./markdown.cjs");

const LINK = /\[[^\]\n]*\]\(([^)\s#]+)(?:#[^)]*)?\)/gu;
const LIST_ITEM = /^\s*(?:\d+\.|-)\s+(.*)$/u;
const CLAUSE_BREAK = /[.!?;]\s+\S/u;
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|cf)\./giu;

/** Options each op accepts besides the common keys; the engine refuses any other key. */
const OPTIONS = {
  required: ["field"],
  max: ["measure", "field", "max"],
  pattern: ["regex", "field", "line"],
  forbidden: ["regex", "field", "line", "scope"],
  sections: ["allowed", "order", "required", "level"],
  equals: ["field", "to"],
  oneSentence: ["sections", "skipIndentedIn"],
  flatList: ["sections"],
  links: [],
  template: ["template", "optional", "slot", "values"],
  json: ["schema"],
  custom: ["check"],
};

const at = (line, offending, values = {}) => ({ line, offending, values });

/** The values a field, line or scope rule reads, each with its line. */
function targets(ctx, rule) {
  if (rule.field !== undefined) return [{ line: ctx.fm.fieldLine[rule.field] ?? 1, value: ctx.fm.fields[rule.field] ?? "" }];
  if (rule.line !== undefined) return [{ line: rule.line, value: ctx.lines[rule.line - 1] ?? "" }];
  const source = rule.scope === "raw" ? ctx.lines : ctx.prose;
  return source.map((value, index) => ({ line: index + 1, value }));
}

const ops = {
  required(ctx, rule) {
    return rule.field in ctx.fm.fields ? [] : [at(1, undefined)];
  },
  max(ctx, rule) {
    if (rule.measure === "lines") return ctx.lines.length > rule.max ? [at(rule.max + 1, undefined, { actual: ctx.lines.length })] : [];
    if (rule.measure === "files") {
      const count = fs.readdirSync(path.dirname(ctx.abs)).length;
      return count > rule.max ? [at(1, undefined, { actual: count })] : [];
    }
    return targets(ctx, rule)
      .filter(({ value }) => value.length > rule.max)
      .map(({ line, value }) => at(line, value, { actual: value.length }));
  },
  pattern(ctx, rule) {
    const regex = new RegExp(rule.regex, "u");
    return targets(ctx, rule).filter(({ value }) => !regex.test(value)).map(({ line, value }) => at(line, value));
  },
  forbidden(ctx, rule) {
    if (rule.scope === "nofence") {
      const mask = fenceMask(ctx.text);
      const found = [];
      for (const match of ctx.text.matchAll(new RegExp(rule.regex, "gu"))) {
        const line = ctx.text.slice(0, match.index).split("\n").length;
        if (!mask[line - 1]) found.push(at(line, match[0]));
      }
      return found;
    }
    const regex = new RegExp(rule.regex, "u");
    return targets(ctx, rule).filter(({ value }) => regex.test(value)).map(({ line }) => at(line, ctx.lines[line - 1]));
  },
  sections(ctx, rule) {
    const found = [];
    let last = -1;
    const names = headings(ctx.prose).filter((h) => h.level === (rule.level ?? 2));
    for (const { name, line } of names) {
      const rank = rule.allowed ? rule.allowed.indexOf(name) : 0;
      if (rank < 0) found.push(at(line, `## ${name}`, { allowed: rule.allowed.join(", ") }));
      else if (rule.order && rank < last) found.push(at(line, `## ${name}`, { allowed: rule.allowed.join(", ") }));
      else last = rank;
    }
    for (const name of rule.required ?? []) if (!names.some((h) => h.name === name)) found.push(at(1, `${"#".repeat(rule.level ?? 2)} ${name}`, { allowed: (rule.allowed ?? rule.required).join(", ") }));
    return found;
  },
  oneSentence(ctx, rule) {
    const section = sectionOf(ctx.prose);
    const found = [];
    ctx.prose.forEach((line, index) => {
      if (!rule.sections.includes(section[index])) return;
      const item = LIST_ITEM.exec(line);
      if (!item) return;
      if ((rule.skipIndentedIn ?? []).includes(section[index]) && /^\s/u.test(line)) return;
      if (CLAUSE_BREAK.test(item[1].replace(LINK, "").replace(ABBREVIATION, ""))) found.push(at(index + 1, ctx.lines[index]));
    });
    return found;
  },
  flatList(ctx, rule) {
    const section = sectionOf(ctx.prose);
    const found = [];
    ctx.prose.forEach((line, index) => {
      if (rule.sections.includes(section[index]) && LIST_ITEM.test(line) && /^\s/u.test(line)) found.push(at(index + 1, ctx.lines[index]));
    });
    return found;
  },
  equals(ctx, rule) {
    const expected = rule.to === "basename" ? ctx.file.split("/").pop().replace(/\.[^.]+$/u, "") : rule.to;
    const value = ctx.fm.fields[rule.field] ?? "";
    return value === expected ? [] : [at(ctx.fm.fieldLine[rule.field] ?? 1, value, { expected })];
  },
  links(ctx) {
    const found = [];
    ctx.prose.forEach((line, index) => {
      for (const match of line.matchAll(LINK)) {
        const target = match[1];
        if (/^[a-z]+:/iu.test(target)) continue;
        if (!fs.existsSync(path.resolve(path.dirname(ctx.abs), target))) found.push(at(index + 1, match[0], { target }));
      }
    });
    return found;
  },
  template(ctx, rule) {
    const slotSrc = rule.slot ?? "\\{\\{[^}]*\\}\\}";
    const model = parseTemplate(path.resolve(ctx.contractDir, rule.template), slotSrc);
    const doc = shape(ctx.text, ctx.prose, ctx.fm);
    const found = [];
    const say = (line, offending, fix) => found.push({ line, offending, values: {}, fix });
    const comment = ctx.text.search(/<!--/u);
    if (comment >= 0) say(ctx.text.slice(0, comment).split("\n").length, undefined, "comment left, delete every comment");
    const slotRe = new RegExp(slotSrc, "u");
    const noComment = ctx.text.replace(/<!--[\s\S]*?-->/gu, (c) => c.replace(/[^\n]/gu, " ")).split("\n");
    // A slot left in prose, or one of the template's own slots left verbatim anywhere (code included).
    const slot = noComment.findIndex((line, i) => i >= ctx.fm.span && (slotRe.test(ctx.prose[i]) || model.slots.some((s) => line.includes(s))));
    if (slot >= 0) say(slot + 1, ctx.lines[slot], "placeholder left, fill it or omit its section");
    for (const [key, value] of Object.entries(model.fm)) {
      const line = ctx.fm.fieldLine[key] ?? 1;
      const allowed = rule.values?.[key];
      if (!(key in ctx.fm.fields)) { if (!(rule.optional ?? []).includes(key)) say(1, undefined, `front matter key "${key}" missing`); }
      else if (slotRe.test(unquote(ctx.fm.fields[key]))) say(line, ctx.fm.fields[key], `front matter "${key}": placeholder left, fill it`);
      else if (allowed) { if (!allowed.includes(unquote(ctx.fm.fields[key]))) say(line, ctx.fm.fields[key], `front matter "${key}" must be one of ${allowed.join(", ")}`); }
      else if (!slotRe.test(value) && unquote(ctx.fm.fields[key]) !== value) say(line, ctx.fm.fields[key], `front matter "${key}" must be "${value}"`);
      else if (slotRe.test(value) && !unquote(ctx.fm.fields[key]).trim()) say(line, undefined, `front matter "${key}" empty`);
    }
    for (const key of Object.keys(ctx.fm.fields)) if (!(key in model.fm)) say(ctx.fm.fieldLine[key], key, `front matter key "${key}" is not in the template`);
    if (model.hasTitle && (!doc.title.text || !doc.title.text.startsWith(model.titlePrefix))) say(doc.title.line, doc.title.text, `title must start with "${model.titlePrefix}"`);
    const rankOf = (name) => model.sections.findIndex((s) => s.match.test(name));
    let last = -1;
    for (const section of doc.sections) {
      const rank = rankOf(section.name);
      if (rank < 0) say(section.line, `## ${section.name}`, `section "${section.name}" is not in the template`);
      else if (rank < last && !model.sections[rank].repeat) say(section.line, `## ${section.name}`, `section "${section.name}" is out of order`);
      else last = rank;
    }
    for (const expected of model.sections) {
      const actual = doc.sections.find((s) => expected.match.test(s.name));
      if (!actual) {
        if (!(rule.optional ?? []).includes(expected.name)) say(1, undefined, `section "${expected.name}" missing`);
        continue;
      }
      for (const header of expected.headers) if (!actual.headers.includes(header)) say(actual.line, header, `section "${expected.name}": table header differs from the template`);
    }
    return found;
  },
  json(ctx, rule) {
    let data;
    try {
      data = JSON.parse(ctx.text);
    } catch (error) {
      return [at(1, undefined, { error: error.message })].map((f) => ({ ...f, fix: `invalid JSON: ${error.message}` }));
    }
    const schema = JSON.parse(fs.readFileSync(path.resolve(ctx.contractDir, rule.schema), "utf8"));
    return conform(data, schema, "$").map((problem) => ({ line: lineOf(ctx.lines, problem.at), offending: problem.at, values: { problem: problem.say } }));
  },
  custom(ctx, rule) {
    return require(path.join(ctx.checksDir, `${rule.check}.cjs`))(ctx, rule);
  },
};

/** JSON Schema subset: type, enum, const, pattern, required, properties, additionalProperties, items, minItems. */
function conform(value, schema, at) {
  const out = [];
  const say = (message) => out.push({ at, say: `${at} ${message}` });
  const kind = Array.isArray(value) ? "array" : value === null ? "null" : typeof value === "number" && Number.isInteger(value) ? "integer" : typeof value;
  if (schema.type && ![].concat(schema.type).some((t) => t === kind || (t === "number" && kind === "integer"))) return say(`must be ${schema.type}`), out;
  if (schema.const !== undefined && value !== schema.const) say(`must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) say(`must be one of ${schema.enum.join(", ")}`);
  if (schema.pattern && typeof value === "string" && !new RegExp(schema.pattern, "u").test(value)) say(`must match ${schema.pattern}`);
  if (kind === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) say(`misses ${key}`);
    for (const [key, sub] of Object.entries(value)) {
      const rule = schema.properties?.[key] ?? schema.additionalProperties;
      if (rule === false) say(`has unknown key ${key}`);
      else if (rule && typeof rule === "object") out.push(...conform(sub, rule, `${at}.${key}`));
    }
  }
  if (kind === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) say(`needs ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((item, i) => out.push(...conform(item, schema.items, `${at}[${i}]`)));
  }
  return out;
}

/** Best line for a JSON path: the line of its last key. */
function lineOf(lines, at) {
  const key = /\.([\w$-]+)(?:\[\d+\])*$/u.exec(at)?.[1];
  const index = key ? lines.findIndex((l) => l.includes(`"${key}"`)) : -1;
  return index + 1 || 1;
}

const unquote = (value) => String(value).replace(/^"|"$/gu, "");
const cells = (line) => line.split("|").slice(1, -1).map((c) => c.replace(/\s+/gu, " ").trim());

/** Title, level-2 sections with line, body lines and table headers, read from prose (comments and fences blanked). */
function shape(text, prose, fm) {
  const raw = text.split("\n");
  const doc = { title: { text: "", line: 1 }, sections: [] };
  prose.forEach((line, index) => {
    if (index < fm.span) return;
    const h = /^(#{1,2}) (.*)$/u.exec(line);
    if (h?.[1] === "#" && !doc.title.text) doc.title = { text: raw[index], line: index + 1 };
    else if (h?.[1] === "##") doc.sections.push({ name: raw[index].slice(3).replace(/\s+/gu, " ").trim(), line: index + 1, body: [] });
    else doc.sections.at(-1)?.body.push(raw[index]);
  });
  for (const s of doc.sections) {
    s.headers = s.body.filter((l, i) => l.startsWith("|") && /^\|[\s:|-]+\|$/u.test(s.body[i + 1] ?? "")).map((l) => cells(l).join("|"));
  }
  return doc;
}

const templates = new Map();
/** A template read once: front matter values, the title before its first slot, sections with table headers. */
function parseTemplate(file, slotSrc) {
  const key = `${file}\0${slotSrc}`;
  const slotG = new RegExp(slotSrc, "gu");
  if (!templates.has(key)) {
    const text = readText(file);
    const fm = frontmatter(text);
    const doc = shape(text, proseLines(text).map((l, i) => (i < fm.span ? "" : l)), fm);
    const values = Object.fromEntries(Object.entries(fm.fields).map(([k, v]) => [k, unquote(v)]));
    // A section named with a slot, such as `## Run {{number}}`, matches every name of that shape and may repeat.
    const sections = doc.sections.map((s) => ({ ...s, repeat: new RegExp(slotSrc, "u").test(s.name), match: new RegExp(`^${s.name.split(slotG).map((p) => p.replace(/[.*+?^$()|[\]\\{}]/gu, "\\$&")).join(".+")}$`, "u") }));
    templates.set(key, { slots: [...new Set(text.replace(/<!--[\s\S]*?-->/gu, "").match(slotG) ?? [])], hasTitle: Boolean(doc.title.text), fm: values, titlePrefix: doc.title.text.split(new RegExp(slotSrc, "u"))[0].trim(), sections });
  }
  return templates.get(key);
}

module.exports = { ops, OPTIONS, shape, cells };
