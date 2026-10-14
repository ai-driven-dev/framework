# Browser runner

```bash
cd <temporary-directory-outside-application> && npx --offline --no -- @playwright/cli@0.1.17 -s=qa-<run-id> <command>
```

Use the framework pin, never `latest`. One named session per scenario; apply viewport and permissions before initial state. Keep stdout, stderr and exit status visible, without redirects, pipes, substitutions or `|| true`.

`run-code` takes `async page => { ... }`; `page` is the only binding, browser globals belong inside `page.evaluate`. Return observed facts, including expected-outcome timeouts; product mismatches must not throw. Bound waits, measure timed boundaries on both sides, and capture brief transitions inside one `run-code`, never infer them.
