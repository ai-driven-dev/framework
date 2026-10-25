#!/usr/bin/env node
// Usage, from the project root: node validate-plan.cjs <feature-folder>
// The templates in ../assets are the contract: sections, order, table headers, front matter.
const fs = require("fs");
const path = require("path");

const errors = [];
const fail = (file, rule) => errors.push(`${file}: ${rule}`);
const norm = (s) => s.replace(/\s+/g, " ").trim();
const read = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const asset = (name) => read(path.join(__dirname, "..", "assets", name));

function parse(md) {
  const fm = {};
  const head = md.match(/^---\n([\s\S]*?)\n---\n/);
  for (const l of head ? head[1].split("\n") : []) {
    const k = l.match(/^(\w+):\s*(.*)$/);
    if (k) fm[k[1]] = k[2].replace(/^"|"$/g, "");
  }
  const sections = [];
  let title = "";
  let cur = null;
  let fence = false;
  for (const line of (head ? md.slice(head[0].length) : md).split("\n")) {
    if (line.startsWith("```")) fence = !fence;
    const h = !fence && line.match(/^(#{1,2}) (.*)$/);
    if (h && h[1] === "#") title = title || line;
    else if (h) sections.push((cur = { name: norm(h[2]), body: "" }));
    else if (cur) cur.body += `${line}\n`;
  }
  return { fm, title, sections };
}

const cells = (l) => l.split("|").slice(1, -1).map(norm).join("|");
function tableHeaders(body) {
  const lines = body.split("\n");
  return lines.filter((l, i) => l.startsWith("|") && /^\|[\s:|-]+\|$/.test(lines[i + 1] || "")).map(cells);
}
const optional = (body) => (body.match(/<!--[\s\S]*?-->/g) || []).some((c) => /omit/i.test(c));
const section = (doc, name) => doc.sections.find((s) => s.name === name);

function matchTemplate(file, md, tpl) {
  const doc = parse(md);
  const noCode = md.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  if (/<!--/.test(md)) fail(file, "comment left, delete every comment");
  if (/\{\{[^}]*\}\}/.test(noCode)) fail(file, "placeholder {{...}} left, fill it or omit its section");

  for (const [k, v] of Object.entries(tpl.fm)) {
    if (!(k in doc.fm)) fail(file, `front matter key "${k}" missing`);
    else if (!v.includes("{{") && doc.fm[k] !== v) fail(file, `front matter "${k}" must be "${v}"`);
    else if (v.includes("{{") && !doc.fm[k].trim()) fail(file, `front matter "${k}" empty`);
  }
  for (const k of Object.keys(doc.fm)) if (!(k in tpl.fm)) fail(file, `front matter key "${k}" is not in the template`);

  const prefix = tpl.title.split("{{")[0].trim();
  if (!doc.title.startsWith(prefix)) fail(file, `title must start with "${prefix}"`);

  const known = tpl.sections.map((s) => s.name);
  let last = -1;
  for (const s of doc.sections) {
    const i = known.indexOf(s.name);
    if (i < 0) fail(file, `section "${s.name}" is not in the template`);
    else if (i < last) fail(file, `section "${s.name}" is out of order`);
    else last = i;
  }
  for (const t of tpl.sections) {
    const s = section(doc, t.name);
    if (!s) {
      if (!optional(t.body)) fail(file, `section "${t.name}" missing`);
      continue;
    }
    const have = tableHeaders(s.body);
    for (const h of tableHeaders(t.body)) {
      if (!have.includes(h)) fail(file, `section "${t.name}": table header differs from the template`);
    }
  }
  return doc;
}

function checkTree(file, body) {
  const block = (body.match(/```[^\n]*\n([\s\S]*?)```/) || [, ""])[1];
  const stack = [];
  for (const raw of block.split("\n")) {
    const mark = (raw.match(/✅|✏|❌/) || [""])[0];
    const m = raw.replace(/[✅✏❌️]/gu, " ").match(/^([\s│├└─|]*)(\S+)/u);
    if (!m || m[2] === "." || !/^[\w@.\/-]+$/.test(m[2])) continue;
    while (stack.length && stack[stack.length - 1].indent >= m[1].length) stack.pop();
    const rel = [...stack.map((s) => s.name), m[2]].join("/").replace(/\/+/g, "/");
    if (m[2].endsWith("/")) stack.push({ indent: m[1].length, name: m[2].replace(/\/$/, "") });
    const exists = fs.existsSync(path.resolve(rel));
    if ((mark === "✏" || mark === "❌") && !exists) fail(file, `${rel} is marked ${mark === "✏" ? "modify" : "delete"} but does not exist`);
  }
}

const dir = process.argv[2];
const planFile = path.join(dir || "", "plan.md");
function report() {
  if (!errors.length) {
    console.log("VALID");
    process.exit(0);
  }
  console.log(["INVALID", ...errors].join("\n"));
  process.exit(1);
}

if (!dir || !fs.existsSync(planFile)) {
  fail(planFile, "missing, write the plan files first");
  report();
}

const fromSkill = path.relative(path.join(__dirname, ".."), fs.realpathSync(dir));
if (!fromSkill.startsWith("..") && !path.isAbsolute(fromSkill)) {
  fail(dir, "folder is inside the skill itself, write the plan in the project");
}

const planTpl = parse(asset("plan-template.md"));
const phaseTpl = parse(asset("phase-template.md"));
const plan = matchTemplate("plan.md", read(planFile), planTpl);

const listed = (section(plan, "Phases")?.body.match(/^\|\s*\d+\s*\|/gm) || []).length;
if (!listed) fail("plan.md", "no row in ## Phases");
for (const l of section(plan, "Phases")?.body.split("\n") || []) {
  const c = l.split("|").slice(1, -1).map(norm);
  if (!/^\d+$/.test(c[0] || "") || c.length < 4) continue;
  const deps = c[c.length - 1].replace(/`/g, "");
  if (deps !== "none" && !deps.split(/\s*,\s*/).every((d) => /^\d+$/.test(d) && +d < +c[0])) {
    fail("plan.md", `phase ${c[0]} "Depends on" must be "none" or earlier phase numbers`);
  }
}
for (let n = 1; n <= listed; n++) {
  if (!fs.existsSync(path.join(dir, `phase-${n}.md`))) fail(`phase-${n}.md`, "listed in plan.md, file missing");
}
for (const f of fs.readdirSync(dir).filter((f) => /^phase-\d+\.md$/.test(f))) {
  if (parseInt(f.match(/\d+/)[0], 10) > listed) fail(f, "not listed in plan.md");
}
for (const l of (section(plan, "External sources")?.body || "").split("\n")) {
  if (!l.startsWith("|") || /^\|[\s:|-]+\|$/.test(l) || /^\|\s*URL\b/.test(l) || /^\|\s*`?none/i.test(l)) continue;
  if (!l.includes("http")) fail("plan.md", `External sources row without a URL: ${l.slice(0, 40)}`);
}

for (let n = 1; n <= listed; n++) {
  const file = `phase-${n}.md`;
  const f = path.join(dir, file);
  if (!fs.existsSync(f)) continue;
  const md = read(f);
  const doc = matchTemplate(file, md, phaseTpl);
  checkTree(file, section(doc, "Architecture projection")?.body || "");
  const frame = section(doc, "Wireframe")?.body;
  if (frame !== undefined && !(/\(1\)/.test(frame) && /^1\. /m.test(frame))) {
    fail(file, 'section "Wireframe" needs a frame with region (1) and a legend "1. ...", or omit the section');
  }
  const tasks = new Set([...md.matchAll(/^###\s*`?(\d+)\)/gm)].map((m) => m[1]));
  const numbers = [...tasks].map(Number).sort((a, b) => a - b);
  if (numbers.some((n, i) => n !== i + 1)) fail(file, `task numbers must run 1 to ${numbers.length} with no gap`);
  for (const m of (section(doc, "Test acceptance criteria")?.body || "").matchAll(/^\|\s*(\d+)\s*\|/gm)) {
    if (!tasks.has(m[1])) fail(file, `acceptance row ${m[1]} maps to no task`);
  }
}

report();
