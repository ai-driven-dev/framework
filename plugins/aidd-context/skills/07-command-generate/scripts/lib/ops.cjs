"use strict";
// The closed set of generic checks. Each op reads one file view and returns findings; no op knows an artifact kind.
const fs = require("node:fs");
const path = require("node:path");
const { headings, sectionOf, fenceMask, readText, frontmatter, proseLines, COMMENT } = require("./markdown.cjs");

// A slot to fill, written the one way every template marks it.
const SLOT = /\{\{[^}]*\}\}/u;
const LINK = /\[[^\]\n]*\]\(([^)\s#]+)(?:#[^)]*)?\)/gu;
const LIST_ITEM = /^\s*(?:\d+\.|-)\s+(.*)$/u;
const CLAUSE_BREAK = /[.!?;]\s+\S/u;
const ABBREVIATION = /\b(?:e\.g|i\.e|etc|vs|cf)\./giu;

/** Options each op accepts besides the common keys; the engine refuses any other key. */
const OPTIONS = {
  required: ["field"],
  max: ["measure", "field", "max"],
  pattern: ["regex", "field", "line", "any"],
  forbidden: ["regex", "field", "line", "scope"],
  sections: ["allowed", "order", "required", "level"],
  equals: ["field", "to"],
  oneSentence: ["sections", "skipIndentedIn"],
  flatList: ["sections"],
  links: ["inside"],
  template: ["template", "optional", "values"],
  json: ["schema"],
  custom: ["check"],
};

const at = (line, offending, values = {}) => ({ line, offending, values });

/** The values a field, line or scope rule reads, each with its line. */
function targets(ctx, rule) {
  if (rule.field !== undefined) return [{ line: ctx.fm.fieldLine[rule.field] ?? 1, value: ctx.fm.fields[rule.field] ?? "" }];
  if (rule.line !== undefined) return [{ line: rule.line, value: ctx.lines[rule.line - 1] ?? "" }];
  return ctx.prose.map((value, index) => ({ line: index + 1, value }));
}

const ops = {
  required(ctx, rule) {
    return rule.field in ctx.fm.fields ? [] : [at(1, undefined)];
  },
  max(ctx, rule) {
    if (rule.measure === "lines") return ctx.lines.length > rule.max ? [at(rule.max + 1, undefined, { actual: ctx.lines.length })] : [];
    return targets(ctx, rule)
      .filter(({ value }) => value.length > rule.max)
      .map(({ line, value }) => at(line, value, { actual: value.length }));
  },
  pattern(ctx, rule) {
    const regex = new RegExp(rule.regex, "u");
    if (rule.any) return targets(ctx, rule).some(({ value }) => regex.test(value)) ? [] : [at(1, undefined)];
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
    const expected = rule.to === "basename" ? ctx.file.split("/").pop().replace(/\.[^.]+$/u, "") : rule.to === "folder" ? path.basename(ctx.root) : rule.to;
    const value = unquote(ctx.fm.fields[rule.field] ?? "");
    return value === expected ? [] : [at(ctx.fm.fieldLine[rule.field] ?? 1, value, { expected })];
  },
  links(ctx, rule) {
    const found = [];
    ctx.prose.forEach((line, index) => {
      for (const match of line.matchAll(LINK)) {
        const target = match[1];
        if (/^[a-z]+:/iu.test(target)) continue;
        const resolved = path.resolve(path.dirname(ctx.abs), target);
        if (rule.inside) {
          const from = path.relative(ctx.root, resolved);
          if (from.startsWith("..") || path.isAbsolute(from)) found.push(at(index + 1, match[0], { target }));
        } else if (!fs.existsSync(resolved)) found.push(at(index + 1, match[0], { target }));
      }
    });
    return found;
  },
  /**
   * The file follows a template: front matter, one title, then the heading tree (levels 2-6) read outside fences and comments.
   * Under each heading matched to a template heading, its child headings are checked: unknown, out of order (unless the template heading holds a {{slot}} and repeats), missing.
   * `optional` lists bare heading and front matter names that may be omitted at any level; a name shared by two parents is ambiguous and omits both.
   * A second level-1 heading is flagged, one title only. Table headers are checked on every instance of a matched heading.
   */
  template(ctx, rule) {
    const model = parseTemplate(path.resolve(ctx.contractDir, rule.template));
    const doc = shape(ctx.text, ctx.prose, ctx.fm);
    const found = [];
    const say = (line, offending, fix) => found.push({ line, offending, fix });
    const comment = ctx.text.search(/<!--/u);
    if (comment >= 0) say(ctx.text.slice(0, comment).split("\n").length, undefined, "comment left, delete every comment");
    const noComment = ctx.text.replace(COMMENT, (c) => c.replace(/[^\n]/gu, " ")).split("\n");
    // A slot left in prose, or one of the template's own slots left verbatim anywhere (code included).
    const slot = noComment.findIndex((line, i) => i >= ctx.fm.span && (SLOT.test(ctx.prose[i]) || model.slots.some((s) => line.includes(s))));
    if (slot >= 0) say(slot + 1, ctx.lines[slot], "placeholder left, fill it or omit its section");
    frontMatterIssues(ctx, model, rule, say);
    if (model.hasTitle && (!doc.title.text || !doc.title.text.startsWith(model.titlePrefix))) say(doc.title.line, doc.title.text, `title must start with "${model.titlePrefix}"`);
    if (model.hasTitle) for (const extra of doc.extraTitles) say(extra.line, extra.text, "one title only, delete or demote this heading");
    checkChildren(model.sections, doc.sections, null, rule.optional ?? [], say);
    return found;
  },
  json(ctx, rule) {
    let data;
    try {
      data = JSON.parse(ctx.text);
    } catch (error) {
      return [{ line: 1, fix: `invalid JSON: ${error.message}` }];
    }
    return validateJson(data, path.resolve(ctx.contractDir, rule.schema)).map((problem) => ({ line: lineOf(ctx.lines, problem.at), offending: problem.at, values: { problem: problem.say } }));
  },
  custom(ctx, rule) {
    return require(path.join(ctx.customDir, `${rule.check}.cjs`))(ctx, rule);
  },
};

/** Doc headings against the template headings of one parent: unknown, out of order (unless it repeats), missing (unless optional), table headers on every instance, then each matched pair one level down. */
function checkChildren(expectedList, actualList, parent, optional, say, root = expectedList) {
  const kind = (node) => (node.level === 2 ? "section" : "heading");
  // A slotted name is shown as the heading to write, its slots as <fill-ins>.
  const slotsOf = (node) => node.name.match(new RegExp(SLOT.source, "gu")) ?? [];
  const fillIn = (s) => s.replace(/\{\{([^}]*)\}\}/gu, "<$1>");
  const written = (node) => `"${"#".repeat(node.level)} ${fillIn(node.name)}"`;
  const shape = (node) => (node.repeat ? written(node) : `"${node.name}"`);
  const rankOf = (name) => expectedList.findIndex((e) => e.match.test(name));
  // Where an unknown heading belongs, so the fix is written once, not guessed: its place elsewhere in the template, else what this level holds.
  const placeOf = (name, list = root, above = null) => {
    for (const node of list) {
      if (node.match.test(name)) return { node, above };
      const deeper = placeOf(name, node.children, node);
      if (deeper) return deeper;
    }
    return undefined;
  };
  const hint = (name) => {
    const place = placeOf(name);
    if (place) return `: write it as ${written(place.node)}${place.above ? ` under ${written(place.above)}` : ""}`;
    return expectedList.length ? `; here the template has ${expectedList.map(written).join(", ")}` : "; remove it or move its text into the parent";
  };
  let last = -1;
  for (const actual of actualList) {
    const rank = rankOf(actual.name);
    const shown = `${"#".repeat(actual.level)} ${actual.name}`;
    if (rank < 0) say(actual.line, shown, `${kind(actual)} "${actual.name}" is not in the template${parent ? ` under "${parent.name}"` : ""}${hint(actual.name)}`);
    else if (rank < last && !expectedList[rank].repeat) say(actual.line, shown, `${kind(actual)} "${actual.name}" is out of order`);
    else last = rank;
  }
  for (const expected of expectedList) {
    const actuals = actualList.filter((a) => expected.match.test(a.name));
    if (!actuals.length) {
      if (!optional.includes(expected.name)) say(parent ? parent.line : 1, undefined, `${kind(expected)} ${shape(expected)} missing${parent ? ` under "${parent.name}"` : ""}${expected.repeat ? `: write it with ${slotsOf(expected).map(fillIn).join(", ")} filled in` : ""}`);
      continue;
    }
    for (const actual of actuals) {
      for (const header of expected.headers) if (!actual.headers.includes(header)) say(actual.line, header, `${kind(expected)} ${shape(expected)}: table header differs from the template`);
      checkChildren(expected.children, actual.children, actual, optional, say, root);
    }
  }
}

/** Front matter keys and values the template expects, as `say(line, offending, fix)` calls. */
function frontMatterIssues(ctx, model, rule, say) {
  for (const [key, value] of Object.entries(model.fm)) {
    const line = ctx.fm.fieldLine[key] ?? 1;
    const allowed = rule.values?.[key];
    if (!(key in ctx.fm.fields)) { if (!(rule.optional ?? []).includes(key)) say(1, undefined, `front matter key "${key}" missing`); }
    else if (SLOT.test(unquote(ctx.fm.fields[key]))) say(line, ctx.fm.fields[key], `front matter "${key}": placeholder left, fill it`);
    else if (allowed) { if (!allowed.includes(unquote(ctx.fm.fields[key]))) say(line, ctx.fm.fields[key], `front matter "${key}" must be one of ${allowed.join(", ")}`); }
    else if (value !== "" && !SLOT.test(value) && unquote(ctx.fm.fields[key]) !== value) say(line, ctx.fm.fields[key], `front matter "${key}" must be "${value}"`);
    else if (SLOT.test(value) && !unquote(ctx.fm.fields[key]).trim()) say(line, undefined, `front matter "${key}" empty`);
  }
  for (const key of Object.keys(ctx.fm.fields)) if (!(key in model.fm)) say(ctx.fm.fieldLine[key], key, `front matter key "${key}" is not in the template`);
}

const JSON_ANNOTATIONS = ["$schema", "$id", "$comment", "title", "description", "default", "examples", "allowTrailingCommas"];
const JSON_ASSERTIONS = ["type", "enum", "const", "pattern", "required", "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "minItems", "maxItems", "uniqueItems"];
const JSON_SUBSCHEMA = ["items", "not", "propertyNames"];
const JSON_SUBSCHEMAS = ["anyOf", "allOf", "oneOf"];
const JSON_MAPS = ["properties", "$defs"];

/** What a schema uses beyond the subset, as messages: an unknown keyword fails at load, never passes unchecked. */
function schemaProblems(schema, at = "#", root = schema) {
  const out = [];
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) return [`${at} must be a schema object`];
  for (const [key, value] of Object.entries(schema)) {
    const here = `${at}/${key}`;
    if (JSON_ANNOTATIONS.includes(key)) continue;
    if (JSON_ASSERTIONS.includes(key)) {
      if (key === "pattern") try { new RegExp(value, "u"); } catch { out.push(`${here} is not a valid pattern`); }
    } else if (key === "additionalProperties") {
      if (typeof value !== "boolean") out.push(...schemaProblems(value, here, root));
    } else if (JSON_SUBSCHEMA.includes(key)) out.push(...schemaProblems(value, here, root));
    else if (JSON_SUBSCHEMAS.includes(key)) value.forEach((sub, i) => out.push(...schemaProblems(sub, `${here}/${i}`, root)));
    else if (JSON_MAPS.includes(key)) for (const [name, sub] of Object.entries(value)) out.push(...schemaProblems(sub, `${here}/${name}`, root));
    else if (key === "format") { if (value !== "uri") out.push(`${here} format ${value} is not supported`); }
    else if (key === "$ref") { if (!/^#\/\$defs\/[^/]+$/u.test(value) || !root.$defs?.[value.slice(8)]) out.push(`${here} must point to a #/$defs/<name> of the same file`); }
    else out.push(`${here} keyword ${key} is not supported`);
  }
  return out;
}

const SCHEMAS = new Map();
/** A schema file read and checked once; one outside the subset throws. */
function readSchema(file) {
  if (!SCHEMAS.has(file)) {
    const schema = JSON.parse(fs.readFileSync(file, "utf8"));
    const unsupported = schemaProblems(schema);
    if (unsupported.length) throw new Error(`${file}: ${unsupported.join("; ")}`);
    SCHEMAS.set(file, schema);
  }
  return SCHEMAS.get(file);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** JSON Schema subset (see schemaProblems): type, enum, const, pattern, format uri, required, properties, additionalProperties, propertyNames, items, min/max of numbers, strings and arrays, uniqueItems, anyOf, allOf, oneOf, not, $ref to $defs. */
function conform(value, schema, at, root = schema) {
  const out = [];
  const say = (message) => out.push({ at, say: `${at} ${message}` });
  const sub = (v, s, where) => conform(v, s, where, root);
  if (schema.$ref) return sub(value, root.$defs[schema.$ref.slice(8)], at);
  const kind = Array.isArray(value) ? "array" : value === null ? "null" : typeof value === "number" && Number.isInteger(value) ? "integer" : typeof value;
  if (schema.type && ![].concat(schema.type).some((t) => t === kind || (t === "number" && kind === "integer"))) return say(`must be ${schema.type}`), out;
  if (schema.const !== undefined && !same(value, schema.const)) say(`must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((option) => same(option, value))) say(`must be one of ${schema.enum.map((o) => JSON.stringify(o)).join(", ")}`);
  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) say(`must match ${schema.pattern}`);
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) say(`needs ${schema.minLength} character(s) at least`);
    if (schema.maxLength !== undefined && length > schema.maxLength) say(`needs ${schema.maxLength} character(s) at most`);
    if (schema.format === "uri" && !URL.canParse(value)) say("must be a uri");
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) say(`must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) say(`must be at most ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) say(`must be above ${schema.exclusiveMinimum}`);
  }
  if (kind === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) say(`misses ${key}`);
    for (const [key, item] of Object.entries(value)) {
      if (schema.propertyNames) out.push(...sub(key, schema.propertyNames, `${at}.${key}`).map((p) => ({ ...p, say: `${p.say} (key)` })));
      const rule = schema.properties?.[key] ?? schema.additionalProperties;
      if (rule === false) say(`has unknown key ${key}`);
      else if (rule && typeof rule === "object") out.push(...sub(item, rule, `${at}.${key}`));
    }
  }
  if (kind === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) say(`needs ${schema.minItems} item(s) at least`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) say(`needs ${schema.maxItems} item(s) at most`);
    if (schema.uniqueItems && value.some((item, i) => value.findIndex((other) => same(other, item)) !== i)) say("must hold no duplicate");
    if (schema.items) value.forEach((item, i) => out.push(...sub(item, schema.items, `${at}[${i}]`)));
  }
  for (const branch of schema.allOf ?? []) out.push(...sub(value, branch, at));
  if (schema.anyOf || schema.oneOf) {
    const results = (schema.anyOf ?? schema.oneOf).map((branch) => sub(value, branch, at));
    const matching = results.filter((r) => r.length === 0).length;
    if (schema.anyOf && matching === 0) say(`matches no alternative (${[...new Set(results.map((r) => r[0].say.slice(at.length + 1)))].slice(0, 4).join("; ")})`);
    if (schema.oneOf && matching !== 1) say(`must match exactly one alternative, matches ${matching}`);
  }
  if (schema.not && sub(value, schema.not, at).length === 0) say("must not match the forbidden form");
  return out;
}

/** The problems of a parsed value against a schema file, as `{ at, say }`; readSchema throws on a schema outside the subset. */
function validateJson(data, schemaFile) {
  return conform(data, readSchema(schemaFile), "$");
}

/** Best line for a JSON path: the line of its last key. */
function lineOf(lines, at) {
  const key = /\.([\w$-]+)(?:\[\d+\])*$/u.exec(at)?.[1];
  const index = key ? lines.findIndex((l) => l.includes(`"${key}"`)) : -1;
  return index + 1 || 1;
}

const unquote = (value) => String(value).replace(/^"|"$/gu, "");
const cells = (line) => line.split("|").slice(1, -1).map((c) => c.replace(/\s+/gu, " ").trim());

/** Title and the heading tree (levels 2-6, each with line, body lines, table headers and children), read from prose (comments and fences blanked); further level-1 headings are listed apart. */
function shape(text, prose, fm) {
  const raw = text.split("\n");
  const doc = { title: { text: "", line: 1 }, extraTitles: [], sections: [] };
  const stack = [];
  prose.forEach((line, index) => {
    if (index < fm.span) return;
    const h = /^(#{1,6}) (.*)$/u.exec(line);
    if (h?.[1] === "#") {
      if (!doc.title.text) doc.title = { text: raw[index], line: index + 1 };
      else doc.extraTitles.push({ text: raw[index], line: index + 1 });
      stack.length = 0;
      return;
    }
    if (h) {
      const level = h[1].length;
      while (stack.length && stack.at(-1).level >= level) stack.pop();
      const node = { level, name: raw[index].slice(level + 1).replace(/\s+/gu, " ").trim(), line: index + 1, body: [], children: [] };
      (stack.at(-1)?.children ?? doc.sections).push(node);
      stack.push(node);
    }
    stack.at(-1)?.body.push(raw[index]);
  });
  const finish = (nodes) => {
    for (const s of nodes) {
      s.headers = s.body.filter((l, i) => l.startsWith("|") && /^\|[\s:|-]+\|$/u.test(s.body[i + 1] ?? "")).map((l) => cells(l).join("|"));
      finish(s.children);
    }
  };
  finish(doc.sections);
  return doc;
}

const templates = new Map();
/** A template read once: front matter values, the title before its first slot, sections with table headers. */
function parseTemplate(file) {
  const slotG = new RegExp(SLOT.source, "gu");
  if (!templates.has(file)) {
    const text = readText(file);
    const fm = frontmatter(text);
    const doc = shape(text, proseLines(text).map((l, i) => (i < fm.span ? "" : l)), fm);
    const values = Object.fromEntries(Object.entries(fm.fields).map(([k, v]) => [k, unquote(v)]));
    // A heading named with a slot, such as `## Run {{number}}`, matches every name of that shape and may repeat.
    const withMatch = (nodes) => nodes.map((s) => ({ ...s, repeat: SLOT.test(s.name), match: new RegExp(`^${s.name.split(slotG).map((p) => p.replace(/[.*+?^$()|[\]\\{}]/gu, "\\$&")).join(".+")}$`, "u"), children: withMatch(s.children) }));
    const sections = withMatch(doc.sections);
    templates.set(file, { slots: [...new Set(text.replace(COMMENT, "").match(slotG) ?? [])], hasTitle: Boolean(doc.title.text), fm: values, titlePrefix: doc.title.text.split(SLOT)[0].trim(), sections });
  }
  return templates.get(file);
}

module.exports = { ops, OPTIONS, shape, cells, LINK, schemaProblems, readSchema, validateJson };
