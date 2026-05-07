# 07 -- Emit Webhook

Sends the run record to a SIEM endpoint when configured.

## Inputs

- `audit_path` (required) -- absolute path to the run JSON written by `06-write-audit`
- `config` (required) -- parsed `.claude/aidd-async-dev.json`

## Outputs

```json
{ "webhook_emitted": true, "status_code": 204 }
```

## Depends on

- `06-write-audit`

## Process

1. If `config.webhook_url` is `null`, return `{ "webhook_emitted": false }` and stop.
2. Read the run record JSON.
3. Construct a CloudEvents-compatible envelope: `{ specversion: "1.0", type: "io.aidd.async-dev.run", source: "<repo url>", id: "<run_id>", time: "<ISO8601>", data: <run record> }`.
4. POST to `config.webhook_url` with `Content-Type: application/cloudevents+json`.
5. On 2xx, return `{ webhook_emitted: true, status_code }`. On non-2xx or network error, append the error to the audit record and return `{ webhook_emitted: false, error }`. Do not fail the overall run on webhook failure.

## Test

With `config.webhook_url` pointing at a real test endpoint (e.g. `https://webhook.site/<id>`): action returns `webhook_emitted: true` with a 2xx status, and the endpoint shows a JSON body containing the run id. With `webhook_url` null, action returns `webhook_emitted: false` and makes no HTTP call.
