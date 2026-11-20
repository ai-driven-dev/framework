#!/usr/bin/env node
"use strict";
// Usage: node scaffold.cjs <contract.json> <target-folder> <file>...
// Copies the template a contract's template rule names to each requested file, at the right path; never overwrites, validates nothing.
const fs = require("node:fs");
const path = require("node:path");
const { loadContract, ContractError } = require("./engine.cjs");

function scaffold(contractFile, target, wanted) {
  const contract = loadContract(contractFile);
  const rules = Object.values(contract.rules).filter((r) => r.op === "template");
  return wanted.map((file) => {
    const rule = rules.find((r) => r.match.some((m) => m.test(file)));
    if (!rule) throw new ContractError(`${file}: no template rule in ${contractFile}`);
    const dest = path.join(target, file);
    if (fs.existsSync(dest)) return `kept ${dest}`;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.resolve(contract.dir, rule.template), dest);
    return `created ${dest}`;
  });
}

if (require.main === module) {
  const [contractFile, target, ...wanted] = process.argv.slice(2);
  try {
    if (!target || !wanted.length) throw new ContractError("usage: scaffold.cjs <contract.json> <target-folder> <file>...");
    console.log(scaffold(contractFile, target, wanted).join("\n"));
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    console.error(error.message);
    process.exitCode = 2;
  }
}

module.exports = { scaffold };
