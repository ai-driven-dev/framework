#!/usr/bin/env node
// Validates YAML syntax using the repository's Node dependency, avoiding Python in hooks.

import { readFile } from "node:fs/promises";
import { load } from "js-yaml";

const files = process.argv.slice(2).filter((file) => file !== "--");
const errors = [];

for (const file of files) {
  try {
    load(await readFile(file, "utf8"), { filename: file });
  } catch (error) {
    errors.push(`${file}: ${error.message}`);
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `❌ ${error}`).join("\n"));
  process.exit(1);
}

console.log(`YAML validation passed for ${files.length} file(s).`);
