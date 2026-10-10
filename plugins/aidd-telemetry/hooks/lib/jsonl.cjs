const fs = require("node:fs");
const path = require("node:path");

function readLines(file) {
  try {
    return fs.readFileSync(file, "utf8").split("\n").filter((line) => line !== "");
  } catch {
    return [];
  }
}

/** Objects with exactly `fields`; any other line is skipped, never guessed at. */
function readRecords(file, fields) {
  const records = [];
  for (const line of readLines(file)) {
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      continue;
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
    const keys = Object.keys(value);
    if (keys.length === fields.length && fields.every((field) => keys.includes(field))) {
      records.push(value);
    }
  }
  return records;
}

/** Appends one line, first closing a last line a crash left unterminated. With `dropTornTail`
 * the unterminated text is cut off instead of closed: for a log whose reader ignores such a
 * tail but refuses a terminated line that is not a record, closing it would turn a write not
 * yet made into damage. */
function appendRecord(file, record, { dropTornTail = false } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let prefix = "";
  try {
    const size = fs.statSync(file).size;
    if (size > 0) {
      const fd = fs.openSync(file, "r+");
      try {
        const last = Buffer.alloc(1);
        fs.readSync(fd, last, 0, 1, size - 1);
        if (last[0] !== 0x0a) {
          if (dropTornTail) fs.ftruncateSync(fd, lengthThroughLastNewline(fd, size));
          else prefix = "\n";
        }
      } finally {
        fs.closeSync(fd);
      }
    }
  } catch {
    // no file yet
  }
  fs.appendFileSync(file, `${prefix}${JSON.stringify(record)}\n`);
}

/** The length of the file up to and including its last newline; 0 when it has none. */
function lengthThroughLastNewline(fd, size) {
  const chunk = Buffer.alloc(4096);
  for (let end = size; end > 0; end -= chunk.length) {
    const start = Math.max(0, end - chunk.length);
    const read = fs.readSync(fd, chunk, 0, end - start, start);
    const at = chunk.subarray(0, read).lastIndexOf(0x0a);
    if (at !== -1) return start + at + 1;
  }
  return 0;
}

module.exports = { readRecords, appendRecord };
