"use strict";
// Registered generators: { name, watch, run({ root, write }) => paths of generated files that are stale }.
// With write false, run changes nothing; with write true it rewrites each stale file and still returns its path.
// `watch` lists the globs of the files a generator reads or writes: a scoped run runs it only when a given file matches.
module.exports = [require("./catalogs.cjs"), require("./catalog-extras.cjs"), require("./readme.cjs"), require("./aidd-ui-engine.cjs")];
