import { describe, expect, it } from "vitest";
import {
  decideUpdate,
  type UpdateDecision,
} from "../../../../src/contexts/update/domain/update-decision.js";

const flags = (check: boolean, dryRun: boolean, force: boolean) => ({ check, dryRun, force });

describe("decideUpdate", () => {
  it.each<[string, string, string, ReturnType<typeof flags>, UpdateDecision]>([
    ["check, outdated", "2.5.0", "2.6.0", flags(true, false, false), "check-available"],
    ["check, current", "2.5.0", "2.5.0", flags(true, false, false), "check-current"],
    ["no flags, current", "2.5.0", "2.5.0", flags(false, false, false), "up-to-date"],
    ["no flags, outdated", "2.5.0", "2.6.0", flags(false, false, false), "install"],
    ["dry run, outdated", "2.5.0", "2.6.0", flags(false, true, false), "dry-run"],
    ["dry run, current", "2.5.0", "2.5.0", flags(false, true, false), "up-to-date"],
    ["force, current", "2.5.0", "2.5.0", flags(false, false, true), "install"],
    ["force and dry run, current", "2.5.0", "2.5.0", flags(false, true, true), "dry-run"],
  ])("%s", (_label, current, latest, given, expected) => {
    expect(decideUpdate(current, latest, given)).toBe(expected);
  });
});
