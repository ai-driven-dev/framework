// A typed `aidd telemetry task ...` is run by the hook, so it is parsed here by a grammar that
// has no shell in it. Anything outside it is not run, and the prompt goes on to the ordinary gate.
const INTERCEPT = /^\s*!?\s*aidd[ \t]+telemetry[ \t]+task\b/u;
const FORBIDDEN = /[;&|`$()<>\r\n\\]/u;
const WORD = /^[\p{L}\p{N}._:/@#+,=-]+$/u;
const QUOTED = /^"([^"]*)"|^'([^']*)'/u;

function isIntercept(prompt) {
  return typeof prompt === "string" && INTERCEPT.test(prompt);
}

function tokens(rest) {
  const out = [];
  let remaining = rest.trim();
  while (remaining !== "") {
    const quoted = QUOTED.exec(remaining);
    let value;
    let length;
    if (quoted) {
      value = quoted[1] ?? quoted[2];
      length = quoted[0].length;
      if (value === "" || value.trim() !== value) return null;
    } else {
      const word = /^[^\s"']+/u.exec(remaining);
      if (!word || !WORD.test(word[0])) return null;
      value = word[0];
      length = word[0].length;
    }
    const next = remaining.slice(length);
    // A token ends at whitespace; `"a"b` is not one.
    if (next !== "" && !/^\s/u.test(next)) return null;
    out.push({ value, quoted: Boolean(quoted) });
    remaining = next.trim();
  }
  return out;
}

/** The CLI argument list a typed declaration stands for, or null when it is not understood.
 * Accepts `<name>`, `--ticket <ref>` and `--none`, nothing else: no other option, so a person
 * cannot reach `--by`, `--help` or anything the CLI adds later. */
function parseDeclaration(prompt) {
  if (!isIntercept(prompt) || FORBIDDEN.test(prompt)) return null;
  const rest = prompt.replace(INTERCEPT, "");
  const parsed = tokens(rest);
  if (parsed === null) return null;
  let name = null;
  let ticket = null;
  let none = false;
  for (let i = 0; i < parsed.length; i += 1) {
    const { value, quoted } = parsed[i];
    if (!quoted && value === "--none") {
      if (none) return null;
      none = true;
    } else if (!quoted && value === "--ticket") {
      const next = parsed[i + 1];
      if (ticket !== null || next === undefined || next.value.startsWith("-")) return null;
      ticket = next.value;
      i += 1;
    } else if (value.startsWith("-") || name !== null) {
      return null;
    } else {
      name = value;
    }
  }
  if (none && (name !== null || ticket !== null)) return null;
  if (ticket !== null && name === null) return null;
  const argv = ["telemetry", "task"];
  if (name !== null) argv.push(name);
  if (ticket !== null) argv.push("--ticket", ticket);
  if (none) argv.push("--none");
  argv.push("--by", "hook-intercept");
  return argv;
}

/** Whether a prompt is a declaration the person tried to type: one line that starts like one,
 * reads like a command rather than a sentence (no `?`, no `!` after the optional leading one,
 * no comma, no final full stop), and holds only words and quoted strings. Such a prompt that
 * does not parse is a mistake worth saying so; anything else that merely starts with the same
 * words is an ordinary prompt. */
function attemptsDeclaration(prompt) {
  if (!isIntercept(prompt) || /[\r\n]/u.test(prompt)) return false;
  const text = prompt.trim();
  if (/[?,]/u.test(text) || text.replace(/^!/u, "").includes("!") || text.endsWith(".")) return false;
  return tokens(prompt.replace(INTERCEPT, "")) !== null;
}

module.exports = { attemptsDeclaration, isIntercept, parseDeclaration };
