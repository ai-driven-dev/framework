"use strict";
// The plan status and its phases tell one possible story; a blocked plan may stop anywhere.
const { readState, listNumbers } = require("./state.cjs");

const describe = (phase) => phase.status ?? "missing";

module.exports = (ctx) => {
  const { planStatus, phases } = readState(ctx.root);
  const say = (fix) => ({ line: 1, fix });
  if (planStatus === "blocked") return [];
  const found = [];
  if (planStatus === "pending") {
    for (const phase of phases.filter((p) => p.status && p.status !== "pending")) found.push(say(`status pending but phase ${phase.number} is ${phase.status}`));
  }
  if (planStatus === "implemented") {
    for (const phase of phases.filter((p) => p.status !== "done")) found.push(say(`status implemented but phase ${phase.number} is ${describe(phase)}`));
  }
  const running = phases.filter((phase) => phase.status === "in-progress");
  if (running.length > 1) found.push(say(`phases ${listNumbers(running)} are in-progress together`));
  const byNumber = new Map(phases.map((phase) => [phase.number, phase]));
  for (const phase of phases.filter((p) => p.status === "in-progress" || p.status === "done")) {
    for (const need of phase.dependencies.map((number) => byNumber.get(number)).filter((dep) => dep && dep.status !== "done")) {
      found.push(say(`phase ${phase.number} is ${phase.status} but depends on phase ${need.number} (${describe(need)})`));
    }
  }
  return found;
};
