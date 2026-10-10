import { describe, expect, it } from "vitest";
import {
  isInstalledDelegate,
  isTrailerCall,
  mentionsDelegate,
  withoutTrailerCall,
} from "../../../../../src/contexts/telemetry/domain/legacy/legacy-hook.js";

const CALL = 'sh "/repo/.git/hooks/aidd-session-trailer.sh" "$@"';

describe("the line that called the trailer delegate", () => {
  it("is recognised whatever path was baked into it", () => {
    expect(isTrailerCall(CALL)).toBe(true);
    expect(isTrailerCall('  sh "C:/r/.git/hooks/aidd-session-trailer.sh" "$@"  ')).toBe(true);
  });

  it("is not a line that only resembles it", () => {
    expect(isTrailerCall('sh "/x/other.sh" "$@"')).toBe(false);
    expect(isTrailerCall('echo sh "/x/aidd-session-trailer.sh" "$@"')).toBe(false);
    expect(isTrailerCall('sh "/x/aidd-session-trailer.sh" "$@" || true')).toBe(false);
  });
});

describe("a hook without that line", () => {
  it("is untouched when the line is not there", () => {
    expect(withoutTrailerCall("#!/bin/sh\necho hi\n")).toEqual({ kind: "untouched" });
  });

  it("keeps every other byte, line endings and a missing final newline included", () => {
    expect(withoutTrailerCall(`#!/bin/sh\r\necho hi\r\n${CALL}`)).toEqual({
      kind: "rewritten",
      text: "#!/bin/sh\r\necho hi\r",
    });
    expect(withoutTrailerCall(`#!/bin/sh\necho a\n${CALL}\necho b\n`)).toEqual({
      kind: "rewritten",
      text: "#!/bin/sh\necho a\necho b\n",
    });
  });

  it("is emptied when the previous version wrote the file and nothing else is in it", () => {
    expect(withoutTrailerCall(`#!/bin/sh\n${CALL}\n`)).toEqual({ kind: "emptied" });
  });

  it("is not emptied when somebody else's line remains", () => {
    expect(withoutTrailerCall(`#!/bin/sh\n# mine\n${CALL}\n`).kind).toBe("rewritten");
  });
});

describe("naming the delegate", () => {
  it("is a mention anywhere, a comment included", () => {
    expect(mentionsDelegate("# see aidd-session-trailer.sh")).toBe(true);
    expect(mentionsDelegate("echo hi")).toBe(false);
  });

  it("is ours only with the previous version's own marker near the top", () => {
    const ours =
      "#!/bin/sh\n# Installed by `aidd telemetry on`, removed by `aidd telemetry off`.\nexit 0\n";
    expect(isInstalledDelegate(ours)).toBe(true);
    expect(isInstalledDelegate("#!/bin/sh\nexit 0\n")).toBe(false);
    expect(isInstalledDelegate(`#!/bin/sh\n\n\n# Installed by \`aidd telemetry on\`\n`)).toBe(
      false
    );
  });
});

describe("the edges of that line and file", () => {
  it("takes the line with any run of spaces between its words", () => {
    expect(isTrailerCall('sh  "/x/aidd-session-trailer.sh"  "$@"')).toBe(true);
    expect(isTrailerCall('sh\t"/x/aidd-session-trailer.sh"\t"$@"')).toBe(true);
  });

  it("is emptied when only blank or padded header lines remain", () => {
    expect(withoutTrailerCall(`#!/bin/sh  \n   \n${CALL}\n`)).toEqual({ kind: "emptied" });
    expect(withoutTrailerCall(`  #!/bin/sh\r\n${CALL}`)).toEqual({ kind: "emptied" });
  });

  it("finds the marker when it is indented", () => {
    expect(isInstalledDelegate("#!/bin/sh\n  # Installed by `aidd telemetry on`\n")).toBe(true);
  });
});
