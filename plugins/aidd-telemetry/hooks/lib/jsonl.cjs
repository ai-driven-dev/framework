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

/** Appends one line, first closing a last line a crash left unterminated. */
function appendRecord(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let prefix = "";
  try {
    const size = fs.statSync(file).size;
    if (size > 0) {
      const fd = fs.openSync(file, "r");
      const last = Buffer.alloc(1);
      fs.readSync(fd, last, 0, 1, size - 1);
      fs.closeSync(fd);
      if (last[0] !== 0x0a) prefix = "\n";
    }
  } catch {
    // no file yet
  }
  fs.appendFileSync(file, `${prefix}${JSON.stringify(record)}\n`);
}

module.exports = { readRecords, appendRecord };
