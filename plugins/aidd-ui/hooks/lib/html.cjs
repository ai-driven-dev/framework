// What every page of the engine builds on: text as HTML, a markdown file as a document, a render with
// its tokens inline, and the fingerprint of what a set shows.
const { createHash } = require("node:crypto");

const STYLESHEET_LINK = '<link rel="stylesheet" href="../tokens.css">'; // how a render loads the tokens
const FONT_FLOOR = ":where(html) { font-family: system-ui, sans-serif; }"; // no specificity: any font a render sets wins

/** `text` as HTML text or as an attribute value. */
const escaped = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const inline = (text) => escaped(text).replace(/`([^`]+)`/g, "<code>$1</code>");

const cellsOf = (line) => line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((cell) => cell.trim());
const isRule = (line) => /^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(line ?? "");

/** A markdown file as a document: front matter as chips, then headings, paragraphs, lists, tables and inline code.
 * Every other line is an escaped paragraph. */
function documentOf(text) {
  const lines = text.replaceAll("\r", "").split("\n");
  const html = [];
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) {
      const chips = lines.slice(1, end).filter((line) => line.trim()).map((line) => {
        const at = line.indexOf(":");
        return at < 0 ? `<span class="chip">${escaped(line.trim())}</span>` : `<span class="chip"><span class="key">${escaped(line.slice(0, at).trim())}</span>${escaped(line.slice(at + 1).trim())}</span>`;
      });
      html.push(`<div class="chips">${chips.join("")}</div>`);
      lines.splice(0, end + 1);
    }
  }
  for (let at = 0; at < lines.length; ) {
    const line = lines[at];
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (!line.trim()) at++;
    else if (heading) {
      html.push(`<h${heading[1].length}>${inline(heading[2].trim())}</h${heading[1].length}>`);
      at++;
    } else if (/^- /.test(line)) {
      const items = [];
      for (; at < lines.length && /^- /.test(lines[at]); at++) items.push(`<li>${inline(lines[at].slice(2))}</li>`);
      html.push(`<ul>${items.join("")}</ul>`);
    } else if (/^\s*\|/.test(line) && isRule(lines[at + 1])) {
      const rows = [];
      for (at += 2; at < lines.length && /^\s*\|/.test(lines[at]); at++) rows.push(`<tr>${cellsOf(lines[at]).map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`);
      html.push(`<div class="scroll"><table><thead><tr>${cellsOf(line).map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`);
    } else {
      const rows = [];
      for (; at < lines.length && lines[at].trim() && !/^(#{1,3} |- )/.test(lines[at]); at++) rows.push(lines[at].trim());
      html.push(`<p>${inline(rows.join(" "))}</p>`);
    }
  }
  return `<article class="doc">${html.join("\n")}</article>`;
}

/** `doc` with its stylesheet link replaced by the system font floor, then the tokens when there are any. */
const inlined = (doc, tokens) => doc.replaceAll(STYLESHEET_LINK, () => `<style>\n${FONT_FLOOR}\n${tokens ?? ""}</style>`);

/** What the page shows, hashed: each variant's name and each file's path and text, in order. A review is kept only for the same fingerprint. */
const fingerprintOf = (variants) => createHash("sha256").update(JSON.stringify(variants.map(({ name, files }) => [name, files.map(({ path, text }) => [path, text])]))).digest("hex");

module.exports = { escaped, documentOf, inlined, fingerprintOf, STYLESHEET_LINK, FONT_FLOOR };
