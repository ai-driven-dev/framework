"use strict";
// Preloaded (node --require) into the processes of the every-rule-fires test. Appends "<rule id>" to $FIRED_LOG for each finding printed or returned
// whose path is a scratch fixture: under the OS temp dir, outside the repository, so the real tree's findings never count as proof.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

const log = process.env.FIRED_LOG;
const repo = process.env.FIRED_REPO;
const tmp = [os.tmpdir(), fs.realpathSync(os.tmpdir())];
const inside = (file, dir) => file === dir || file.startsWith(`${dir}${path.sep}`);
const fixture = (file) => path.isAbsolute(file) && tmp.some((dir) => inside(file, dir)) && !inside(file, repo);
const record = (id, file) => fixture(file) && fs.appendFileSync(log, `${id}\n`);

if (log && repo) {
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...rest) => {
    for (const line of String(chunk).split("\n")) {
      const found = /^(.+?):\d+ ([A-Z]+-\d\d) /u.exec(line);
      if (found) record(found[2], found[1]);
    }
    return write(chunk, ...rest);
  };
  const load = Module._load;
  Module._load = function (request, ...rest) {
    const exported = load.call(this, request, ...rest);
    if (exported && typeof exported.check === "function" && typeof exported.loadContract === "function" && !exported.check.recorded) {
      const check = exported.check;
      exported.check = Object.assign((...args) => {
        const found = check(...args);
        for (const f of found) record(f.id, f.path);
        return found;
      }, { recorded: true });
    }
    return exported;
  };
}
