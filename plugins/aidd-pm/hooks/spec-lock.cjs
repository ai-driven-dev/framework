"use strict";
// Refuses a write to a spec whose file, as it stands on disk, declares `status: locked`: only the person who
// approves a spec unlocks it, by hand. It reads the file already there, never the content being written.
// Runs before a tool; under an adapter that does not report that moment, it does nothing. Node built-ins only.
const fs = require("node:fs");
const path = require("node:path");
const host = require("./lib/host.cjs");

const SPEC = /(?:^|\/)aidd_docs\/tasks\/.+\/spec\.md$/u;
const LOCKED = /^status:\s*(["']?)locked\1\s*$/u;

/** Whether `file` is a spec whose front matter holds `status: locked`. */
function locked(file) {
  if (!SPEC.test(file.split(path.sep).join("/"))) return false;
  let lines;
  try {
    lines = fs.readFileSync(file, "utf8").split(/\r?\n/u);
  } catch {
    return false;
  }
  if (lines[0] !== "---") return false;
  for (const line of lines.slice(1)) {
    if (line === "---") return false;
    if (LOCKED.test(line)) return true;
  }
  return false;
}

// refuse() denies only the tool call about to run; on any other event it does nothing.
const event = host.readEvent();
const file = (event?.files ?? []).map((f) => f.path).find(locked);
if (file !== undefined) {
  const shown = path.relative(event.cwd ?? process.cwd(), file).split(path.sep).join("/");
  host.refuse(`${shown} is locked: only the person who approves it sets its status back to draft. Write nothing to it.`);
}
