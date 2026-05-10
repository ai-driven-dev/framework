# Local-mode scheduling

Five paths to run `scripts/aidd-async-poll.sh` periodically. **Remote (GitHub Actions) is the recommended primary path**; the local paths below are for cases where Actions is unavailable or undesirable.

## Why remote should be the default

Every local path consumes some quota:
- Claude Code Desktop scheduled tasks have a per-account daily limit.
- `/schedule` cloud routines have a per-account active-routine cap and a 1-hour minimum cadence.
- Even shell loops invoke `claude -p` per tick, which counts against the OAuth/API token quota.

Remote (GH Actions) runs on GitHub's runners and only consumes the Anthropic auth quota when an issue actually triggers the workflow -- no idle ticks. That makes remote the cheapest long-term option.

## Path table

| # | Path | Uses Claude Code Tasks quota | Min interval | Persistence | Best for |
| - | ---- | ---------------------------- | ------------ | ----------- | -------- |
| A | Remote (GitHub Actions) | no | event-driven | GitHub managed | **default; production** |
| B | Local manual | no | n/a | none | testing, occasional use |
| C | Local daemon (shell loop in tmux/launchd/systemd) | no | seconds | machine running | offline-first dev, lots of issues |
| D | Claude Code Desktop scheduled task | **yes (1 per tick)** | 1 minute | machine awake | small backlog, fast iteration |
| E | `/schedule` cloud routine | **yes (1 routine slot)** | 1 hour | server-side | low-volume hands-off |

Pick A unless you have a specific reason. Pick C as the default local fallback (no Tasks quota); D and E are convenient but quota-limited.

## Path A -- Remote (GitHub Actions)

Set `mode = "remote"` (or `"both"`) at setup. The skill writes `.github/workflows/aidd-async.yml` and stores the auth secret on the repo. GitHub triggers the workflow on the configured label or mention; nothing runs locally.

## Path B -- Local manual

```bash
./scripts/aidd-async-poll.sh --dry-run    # preview what would run
./scripts/aidd-async-poll.sh              # run once, now
```

No scheduling. The poll script invokes `claude -p` only when an issue carries a trigger label.

## Path C -- Local daemon (recommended local default)

A long-running shell loop. **Not** a Claude Code scheduled task: the loop is just a `while true; do ./scripts/aidd-async-poll.sh; sleep N; done`. Each tick that has nothing to do exits immediately and consumes no Anthropic token; ticks that find a trigger fire a single `claude -p`.

Setup writes `scripts/aidd-async-daemon.sh`. Wrap it with a supervisor of your choice:

**tmux** (simplest, manual restart on reboot):
```bash
tmux new -d -s aidd-async './scripts/aidd-async-daemon.sh 300'
tmux ls           # see it
tmux attach -t aidd-async   # watch logs
tmux kill-session -t aidd-async
```

**launchd** (macOS, restart on login):
```xml
<plist version="1.0">
  <dict>
    <key>Label</key><string>com.aidd.async-daemon</string>
    <key>WorkingDirectory</key><string>/abs/path/to/repo</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>/abs/path/to/repo/scripts/aidd-async-daemon.sh</string>
      <string>300</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/aidd-async-daemon.log</string>
    <key>StandardErrorPath</key><string>/tmp/aidd-async-daemon.err</string>
  </dict>
</plist>
```
Save as `~/Library/LaunchAgents/com.aidd.async-daemon.plist`, then `launchctl load ...`.

**systemd --user** (Linux, restart on login):
```ini
[Unit]
Description=aidd-orchestrator async daemon
[Service]
WorkingDirectory=/abs/path/to/repo
ExecStart=/bin/bash /abs/path/to/repo/scripts/aidd-async-daemon.sh 300
Restart=always
[Install]
WantedBy=default.target
```
Save as `~/.config/systemd/user/aidd-async-daemon.service`, then `systemctl --user enable --now aidd-async-daemon`.

The daemon is fully decoupled from Claude Code's Tasks system; cancel it by killing its process.

## Path D -- Claude Code Desktop scheduled task

Convenient when the backlog is small and you want everything inside Claude Code. **Counts against your Tasks quota; one tick = one task slot consumed**, so a 5-minute cadence may exhaust a daily/weekly limit faster than you expect.

1. Open Claude Code Desktop -> Scheduled tasks -> New task.
2. Working directory: the absolute path of this repo.
3. Schedule: choose a cadence; remember the quota.
4. Prompt: `Run ./scripts/aidd-async-poll.sh and report what was processed.`

## Path E -- `/schedule` cloud routine

Convenient when you want the routine to keep running even with the laptop off. **Minimum interval is 1 hour** and routine slots count against your account.

1. In any Claude Code session, run `/schedule`.
2. Cron: `0 * * * *` (every hour) or coarser.
3. Prompt: `Use skill aidd-orchestrator:02:run-async-dev on the next ready issue in {owner}/{repo}.`

## Sanity check before scheduling anything

```bash
./scripts/aidd-async-poll.sh --dry-run
./scripts/aidd-async-poll.sh
```

If the script reports `no open issues with label to-implement`, label one issue and try again before wiring up a supervisor.
