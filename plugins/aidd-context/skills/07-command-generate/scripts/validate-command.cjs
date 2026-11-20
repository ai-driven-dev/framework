#!/usr/bin/env node
"use strict";
// Usage: node validate-command.cjs <command.md>...  Applies ./contract.json; see ./lib/engine.cjs.
const path = require("node:path");
const { run } = require("./lib/engine.cjs");

process.exitCode = run(path.join(__dirname, "contract.json"), process.argv.slice(2));
