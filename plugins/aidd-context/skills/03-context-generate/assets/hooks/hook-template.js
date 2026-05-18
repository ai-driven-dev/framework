// OpenCode hook plugin template.
// Loaded from `.opencode/plugins/` (project) or `~/.config/opencode/plugins/` (global),
// or registered as an npm package under `plugin: ["pkg-name"]` in `opencode.json`.
//
// The default export is a plugin function. It receives a context object
// and returns an object whose keys are OpenCode event names and whose values
// are handler functions.

export default function plugin({ project, client, $ }) {
  return {
    // Replace {{event_name}} with the chosen OpenCode event, e.g.
    //   "tool.execute.before", "session.created", "permission.asked",
    //   "file.edited", "shell.env", "lsp.client.diagnostics".
    "{{event_name}}": async (payload) => {
      // {{handler_body}}
      // Return a value when the event accepts a response shape; otherwise omit.
    },
  };
}
