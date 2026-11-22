#!/usr/bin/env node
/**
 * Fails when two documents carry the same sentence. A fact copied into a second page stops
 * being one fact: the copies drift, and a reader who finds the stale one has no way to tell.
 *
 * A sentence, not a paragraph or a hash of the file: a paragraph moves a word and stops
 * matching, and a whole-file measure never names what to fix. Twelve words is the floor
 * because shorter lines are shared phrasing rather than a shared fact.
 *
 * Repetition inside one page is deliberate as often as not, so only cross-file carriers count.
 */

const fs = require("node:fs");
const path = require("node:path");

/**
 * Sentences two documents are allowed to share, keyed by the normalised sentence, listing
 * every file allowed to carry it with the reason it is there. The only exception this guard
 * accepts, so an entry costs a decision somebody can read back.
 */
const BASELINE = Object.freeze({});

const { sentencesOf, carriersOf, scannedFiles } = require("./check/contracts/custom/doc-duplication.cjs");

function findDuplicates(filesToText, baseline = BASELINE) {
  const duplicates = [];

  for (const [sentence, files] of carriersOf(filesToText)) {
    const allowed = baseline[sentence] ?? {};
    const reported = files.filter((file) => !(file in allowed));
    if (reported.length > 1) duplicates.push({ sentence, files: reported });
  }

  return duplicates;
}

/** An allowance outlives its reason the moment one listed file stops carrying the sentence. */
function staleBaseline(filesToText, baseline = BASELINE) {
  const carriers = carriersOf(filesToText);
  const stale = [];

  for (const [sentence, allowed] of Object.entries(baseline)) {
    const files = carriers.get(sentence) ?? [];
    for (const file of Object.keys(allowed)) {
      if (!files.includes(file)) {
        stale.push(
          `${file} no longer carries "${sentence}" - drop it from BASELINE`
        );
      }
    }
  }

  return stale;
}

function scanRepository(root = process.cwd()) {
  const files = scannedFiles(root);
  const filesToText = Object.fromEntries(
    files.map((file) => [file, fs.readFileSync(path.resolve(root, file), "utf8")])
  );

  return {
    scannedFiles: files.length,
    duplicates: findDuplicates(filesToText),
    stale: staleBaseline(filesToText),
  };
}

function run(root = process.cwd(), logger = console.error, successLogger = console.log) {
  const { scannedFiles: count, duplicates, stale } = scanRepository(root);

  if (duplicates.length === 0 && stale.length === 0) {
    successLogger(`✅ Doc duplication: 0 duplicated sentence(s) in ${count} files`);
    return 0;
  }

  if (duplicates.length > 0) {
    logger(`❌ ${duplicates.length} sentence(s) carried by more than one document`);
    for (const { sentence, files } of duplicates) {
      logger(`  "${sentence}"`);
      for (const file of files) logger(`    ${file}`);
    }
    logger("keep it in one home and point the others at it");
  }

  if (stale.length > 0) {
    logger(`❌ ${stale.length} BASELINE entry(ies) no longer describing the tree`);
    for (const line of stale) logger(`  ${line}`);
  }

  return 1;
}

module.exports = { BASELINE, findDuplicates, scanRepository, sentencesOf, staleBaseline, run };

if (require.main === module) {
  process.exit(run());
}
