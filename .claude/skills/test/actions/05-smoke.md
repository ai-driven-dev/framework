# 05 - Smoke

Run the real built CLI binary in an isolated `/tmp` dir and verify a command works end-to-end.

## Inputs

- `command` (required) - string, the CLI command to invoke (e.g. `aidd widget apply`)
- `expected-behavior` (required) - string, observable outcomes to assert: exit code, stdout/stderr content, files written to the tmp dir

## Outputs

```text
Smoke result:
  dir: /tmp/smoke-<name>
  exit-code: 0
  stdout: <captured output>
  files-written: <list of paths relative to tmp dir>
  verdict: PASS | FAIL
```

## Process

1. Read `references/smoke-in-tmp.md` in full before proceeding.
2. Build the CLI from the current branch: `pnpm build`.
3. Create a fresh isolated directory: `mkdir -p /tmp/smoke-<name> && cd /tmp/smoke-<name> && git init`.
4. Invoke the real binary with the command under test: `node <repo-root>/dist/cli.js <command>`.
5. Capture exit code, stdout, and stderr verbatim.
6. Assert all expected-behavior items: exit code equals 0, expected strings appear in stdout or stderr, expected files exist relative to the tmp dir.
7. Fail explicitly if any assertion fails — show the diff between expected and observed.
8. Cleanup: `rm -rf /tmp/smoke-<name>`.
9. Report the smoke result in the format shown in Outputs.

## Test

```sh
mkdir -p /tmp/smoke-widget && cd /tmp/smoke-widget && git init
node dist/cli.js widget apply
echo "exit: $?"
ls /tmp/smoke-widget
rm -rf /tmp/smoke-widget
```

All three assertions exit 0: build succeeds, binary exits 0, expected files are present.
