"use strict";
const fs = require("node:fs");

/** The file's content, or null when it does not exist: one read instead of a check then a read. */
function readOrNull(file, encoding) {
  try {
    return fs.readFileSync(file, encoding);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

module.exports = { readOrNull };
