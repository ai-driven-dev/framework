// The flags and the usage line of each command of the engine: read by its argument parser and by `help`.
const ROOT_FLAG = "--root";
const FORCE_FLAG = "--force";
const TASK_FLAG = "--task";
const CHANGE_FLAG = "--change";
const BREAKING_FLAG = "--breaking";
const CREATED_FLAG = "--created";
const REMOVED_FLAG = "--removed";

const VALIDATE_USAGE = "node aidd-ui.cjs validate [project-root]";
const TOKENS_USAGE = "node aidd-ui.cjs tokens [project-root]";
const HOOK_USAGE = "node aidd-ui.cjs hook < <host event>";
const IMPACT_USAGE = `node aidd-ui.cjs impact <id or token>… [${ROOT_FLAG} <dir>]`;
const EXTRACT_USAGE = `node aidd-ui.cjs extract [${FORCE_FLAG}] [${ROOT_FLAG} <dir>]`;
const BUMP_USAGE = `node aidd-ui.cjs bump ${TASK_FLAG} <aidd_docs/tasks/…> (${CHANGE_FLAG} "<text>" [${BREAKING_FLAG}] | ${CREATED_FLAG} | ${REMOVED_FLAG}) <token or id>… [${ROOT_FLAG} <dir>]`;
const PUBLISH_USAGE = `node aidd-ui.cjs publish ([${BREAKING_FLAG}] | <id>…) [${ROOT_FLAG} <dir>]`;
const HELP_USAGE = "node aidd-ui.cjs help [<command>]";

module.exports = {
  ROOT_FLAG,
  FORCE_FLAG,
  TASK_FLAG,
  CHANGE_FLAG,
  BREAKING_FLAG,
  CREATED_FLAG,
  REMOVED_FLAG,
  VALIDATE_USAGE,
  TOKENS_USAGE,
  HOOK_USAGE,
  IMPACT_USAGE,
  EXTRACT_USAGE,
  BUMP_USAGE,
  PUBLISH_USAGE,
  HELP_USAGE,
};
