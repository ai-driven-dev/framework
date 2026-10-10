# telemetry-bindings

The contract between the `aidd` CLI, which writes task declarations, and the plugin hooks, which
read them. Neither side may change a format or a rule below without changing this folder, and
both sides test against it: a CLI unit test and a hook test read the same files and must
return the same answers as `expected.json`.

Everything here is synthetic. Session ids, paths and names are made up.

## Files

| File | Holds |
| --- | --- |
| `sessions.jsonl` | one declaration per line, append-only: `{session_id, task, ticket, none, declared_at, by}` |
| `carries.jsonl` | one carry per line: `{session_id, from, at}`, the new session taking the binding of `from` as it stood at `at` |
| `cases.json` | the inputs of every case, by section |
| `expected.json` | the answer to every case, under the same section and case name |

A case in `cases.json` and its answer in `expected.json` have the same name. A case with no
answer, or an answer with no case, is an error.

## Formats

- `sessions.jsonl` lives in `<telemetry dir>/bindings/`, `carries.jsonl` next to it. A line that
  is not a JSON object with exactly these fields is skipped, never guessed at.
- `task` is `null` when `none` is `true`. `ticket` is `null` when none was given. `declared_at` and
  `at` are ISO 8601 UTC instants. `by` is `command` or `hook-intercept`.
- The CLI marks a declaration made on a user's behalf by a hook with its hidden option
  `--by hook-intercept`. A manual declaration is `command`. It is an option, not an environment
  variable: an exported variable would silently relabel every manual declaration.
- A branch declaration is three git config keys, written with `--local`:
  `branch.<name>.aiddTask`, `branch.<name>.aiddTicket`, `branch.<name>.aiddDeclaredAt`. Declared
  as "none" means `aiddDeclaredAt` is set and `aiddTask` is absent or empty. `git config
  --get-regexp` prints the variable part of a key in lower case (`aiddtask`), while the branch
  name keeps its case; a branch name may hold dots, so only the known suffix is cut off.

## Rules each case section pins

- `binding`: is a session, at an instant, bound, and to what. Precedence: a declaration of the
  session effective at that instant (the latest `declared_at` not after it, the later line
  winning a tie), then a carry (resolved from the carried session's binding at the carry's
  own time, following chains, a cycle binding nothing), then the branch. A branch is read only
  when it is a working branch. A declaration made after an instant does not change the answer
  for that instant: earlier work keeps the earlier task.
- `branchRole`: `working`, `default` or `detached`. The default branch is the target of
  `refs/remotes/origin/HEAD`; when the repository has none, `main` and `master`. Only a working
  branch is ever bound.
- `consent`: what a clone's key says alone. Only `2:` followed by a token with no whitespace is a
  grant; a bare `2`, `2:`, `off`, another number or nothing is not. The key is half of consent:
  the token must name an open interval in the consent log, as `hookConsent` pins.
- `consentLog`: `lines` are the lines of `<telemetry dir>/ledger/consents.jsonl`, an object
  (written as JSON) or a string (kept as it is). The answer is `damaged` and the intervals, in the
  order they were opened, as `{token, path, from, to}` with ISO instants (`to` is `null` while
  open). An open line is exactly `{token, clone: {path, dev, ino, birthtimeMs}, open}` and a close
  line exactly `{token, close}`; any other non-blank line is damage. A token opened twice is its
  first opening, a token closed twice ends at the earliest close wherever the lines stand, and a
  close of an unknown token changes nothing. Both sides parse it, and the hooks append close
  lines in this format.
- `hookConsent`: the hook's decision for a `key`, the `lines` of the consent log and the `realpath`
  of the clone's git common dir. `granted` only when the key names an interval that is open and was
  recorded for that same path. `close` lists the open intervals of that path that the key does not
  name, which the hook ends; a damaged log grants and closes nothing. Only the hook test executes
  these cases; the CLI test checks that they are well formed.
- `environmentRefusal`: `AIDD_TELEMETRY` set to exactly `0` refuses; nothing else does.
- `telemetryDir`: `AIDD_TELEMETRY_DIR`, else `AIDD_USER_CONFIG_DIR/telemetry`, else
  `XDG_CONFIG_HOME/aidd/telemetry`, else `<home>/.config/aidd/telemetry`. An empty variable is
  unset. `win32` cases are joined with backslashes.
- `claudeOnly`: a hook acts only when the payload's `session_id` equals `CLAUDE_CODE_SESSION_ID`
  and the payload's `transcript_path`, separators normalised, runs under a `projects`
  directory. The CLI has no such guard, so only the hook test executes these cases; the CLI
  test checks that they are well formed.
