import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../../hooks/aidd-maintenance/session-start.cjs", import.meta.url)
);

export default {
  id: "aidd-maintenance-tui",
  setup(ctx) {
    const sessions = new Set();
    let active = true;
    const show = async (directory, sessionId) => {
      const message = await new Promise((resolve) => {
        let stdout = "";
        const child = spawn("node", [script], {
          cwd: directory,
          stdio: ["pipe", "pipe", "ignore"],
          timeout: 10000,
        });
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.on("error", () => resolve(""));
        child.on("close", (code) => {
          if (code !== 0) return resolve("");
          try {
            resolve(String(JSON.parse(stdout)?.systemMessage ?? "").trim());
          } catch {
            resolve("");
          }
        });
        child.stdin.on("error", () => {});
        child.stdin.end(
          JSON.stringify({
            hook_event_name: "SessionStart",
            session_id: sessionId,
            cwd: directory,
            tool: "opencode",
          })
        );
      });
      if (message && active) ctx.ui.toast.show({ message, variant: "info" });
      return Boolean(message);
    };
    const directory = ctx.location?.directory ?? ctx.data.location?.default?.()?.directory;
    const opening = typeof directory === "string" ? show(directory, null) : null;
    let firstSession = opening !== null;
    const unsubscribe = ctx.data.on("session.created", async (event) => {
      const sessionId = event?.data?.sessionID;
      const sessionDirectory = event?.data?.location?.directory;
      if (typeof sessionId !== "string" || typeof sessionDirectory !== "string" || sessions.has(sessionId))
        return;
      sessions.add(sessionId);
      if (firstSession && sessionDirectory === directory) {
        firstSession = false;
        if (await opening) return;
      }
      await show(sessionDirectory, sessionId);
    });
    return () => { active = false; unsubscribe(); };
  },
};
