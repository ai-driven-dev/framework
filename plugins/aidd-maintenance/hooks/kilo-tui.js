import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./session-start.cjs", import.meta.url));

export default {
  id: "aidd-maintenance-tui",
  async tui(api) {
    const directory = api.state.path.directory;
    if (typeof directory !== "string") return;
    const message = await new Promise((resolve) => {
      let stdout = "";
      const child = spawn("node", [script], {
        cwd: directory,
        stdio: ["pipe", "pipe", "ignore"],
        timeout: 10000,
      });
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.on("error", () => resolve(""));
      child.on("close", (code) => {
        if (code !== 0) return resolve("");
        try { resolve(String(JSON.parse(stdout)?.systemMessage ?? "").trim()); }
        catch { resolve(""); }
      });
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify({ hook_event_name: "SessionStart", cwd: directory, tool: "kilo" }));
    });
    if (message) api.ui.toast({ message, variant: "info" });
  },
};
