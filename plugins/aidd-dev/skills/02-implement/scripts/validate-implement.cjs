#!/usr/bin/env node
"use strict";
// Usage: node validate-implement.cjs <feature-folder>  Applies ./contract.json; see ./lib/engine.cjs.
// When clean, prints a NEXT line saying what follows; that line is navigation, not validation.
const path = require("node:path");
const { run } = require("./lib/engine.cjs");
const { readState, nextStep } = require("./checks/state.cjs");

const targets = process.argv.slice(2);
const code = run(path.join(__dirname, "contract.json"), targets);
if (code === 0 && targets.length === 1) {
  const next = nextStep(readState(targets[0]));
  if (next) console.log(`NEXT: ${next}`);
}
process.exitCode = code;
