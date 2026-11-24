#!/usr/bin/env node
"use strict";
// Usage: node validate-prompt.cjs <saved-prompt>...
const path = require("node:path");
const { run } = require("./lib/engine.cjs");

process.exitCode = run(path.join(__dirname, "contract.json"), process.argv.slice(2));
