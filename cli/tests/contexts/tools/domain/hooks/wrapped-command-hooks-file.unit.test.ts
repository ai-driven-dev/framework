import { describe, expect, it } from "vitest";
import {
  isWrappedCommandHooksFileEmpty,
  unmergeWrappedCommandHooks,
  wrappedCommandHookEntries,
  wrappedCommandHooksScriptDir,
} from "../../../../../src/contexts/tools/domain/hooks/wrapped-command-hooks-file.js";

/** The project hooks file the released CLI wrote for aidd-context, with a hook of the person's own
 * beside it, as captured from that release. */
const COMMAND =
  "node -e \"const p=require('node:child_process').spawn(Buffer.from(process.argv[1],'base64').toString(),{shell:true,cwd:'..',stdio:['inherit','pipe','inherit']});let empty=true;p.stdout.on('data',d=>{empty=false;process.stdout.write(d)});p.on('close',c=>{if(empty)process.stdout.write('{}');process.exitCode=c??1});\" bm9kZSAuLy5hZ2VudHMvaG9va3MvYWlkZC1jb250ZXh0L21lbW9yeS5janMgbG9hZA==";
const TARGET = {
  label: "Antigravity",
  descriptor: { flat: { scriptsDir: ".agents/hooks/" }, eventMap: {}, toolNames: new Map() },
};
const FILE = JSON.stringify({
  "aidd-context": { SessionStart: [{ type: "command", command: COMMAND, timeout: 5 }] },
  lint: { SessionStart: [{ type: "command", command: "echo lint" }] },
});

describe("the project hooks file an earlier release wrote", () => {
  it("reads back the entry the release wrote, under its event", () => {
    const [entry] = wrappedCommandHookEntries(TARGET, FILE, "aidd-context");

    expect([entry?.event, entry?.entry.command]).toStrictEqual(["SessionStart", COMMAND]);
  });

  it("takes one plugin's group out and keeps the person's", () => {
    const kept = unmergeWrappedCommandHooks(FILE, "aidd-context");

    expect(Object.keys(JSON.parse(kept))).toStrictEqual(["lint"]);
    expect(isWrappedCommandHooksFileEmpty(kept)).toBe(false);
    expect(isWrappedCommandHooksFileEmpty(unmergeWrappedCommandHooks(kept, "lint"))).toBe(true);
  });

  it("names the folder the release copied a plugin's scripts to", () => {
    expect(wrappedCommandHooksScriptDir(TARGET, "aidd-context")).toBe(
      ".agents/hooks/aidd-context/"
    );
  });

  it("refuses a group whose event is no list", () => {
    const edited = JSON.stringify({ "aidd-context": { SessionStart: "x" } });

    expect(() => wrappedCommandHookEntries(TARGET, edited, "aidd-context")).toThrow(
      "Antigravity hook 'aidd-context.SessionStart' must be an array."
    );
  });
});
