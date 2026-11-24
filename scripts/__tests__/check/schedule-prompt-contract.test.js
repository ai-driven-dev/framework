"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { validate } = require("./helpers.js");
const { test } = require("node:test");

const validator = path.resolve(__dirname, "../../../plugins/aidd-context/skills/14-schedule-generate/scripts/validate-prompt.cjs");
const english = [
  "# Daily summary", "Summarize new entries.",
  "## Trigger conditions", "At 09:00 Europe/Paris on weekdays, proceed if entries exist.",
  "## Rules", "Skip previously delivered entries.",
  "## Inputs", "Read the scheduler-provided {{event.payload}}.",
  "## Process", "1. Collect entries in the requested window.", "2. Summarize the collected entries.",
  "## Output", "Return Markdown or report the failure."
].join("\n");
const french = [
  "# Bilan quotidien", "Résumer les nouvelles notes.",
  "## Déclenchement", "À 9 h en semaine, à Paris, si des notes existent.",
  "## Règles", "Ignorer les notes déjà livrées.",
  "## Entrées", "Lire les notes du jour.",
  "## Étapes", "1. Collecter les notes.", "2. Résumer les notes collectées.",
  "## Sortie", "Rendre le bilan ou signaler l’échec."
].join("\n");

test("validates saved prompts against the template while allowing translated headings and scheduler variables", () => {
  for (const [content, expected] of [
    [english, null],
    [french, null],
    [english.replace("## Inputs\n", ""), /distinct sections/u],
    [english.replace("## Inputs", "## Process"), /distinct sections/u],
    [english.replace("## Inputs", "## Output").replace("## Output\nReturn", "## Inputs\nReturn"), /template order/u],
    [french.replace("1. Collecter les notes.\n2. Résumer les notes collectées.", "Collecter les notes.").concat("\n1. Finir."), /numbered steps/u],
    [english.replace("Skip previously delivered entries.", ""), /fill this section/u],
    [english.replace("Daily summary", "{{task name}}"), /template slot/u],
    [english.concat("\n```\n{{Outcome to achieve on each run}}\n```"), /template slot/u],
  ]) {
    const { code, out, err } = validate(validator, "job.txt", content);
    assert.equal(code, expected ? 1 : 0, err || out);
    if (expected) assert.match(out, expected);
  }
});
