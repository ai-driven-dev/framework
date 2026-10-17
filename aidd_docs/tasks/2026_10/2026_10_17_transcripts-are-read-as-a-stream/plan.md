---
objective: "A transcript's unread tail is read a block at a time, with the same lines and positions as before, byte for byte."
status: done
---

# Plan: Transcripts are read as a stream

## Overview

| Field | Value |
| --- | --- |
| **Goal** | M3 of the R1 telemetry audit closed: ingest memory no longer grows with a transcript's tail |
| **Source** | [`contract.md`](./contract.md) |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Tests first, red on `origin/next` | [`phase-1.md`](./phase-1.md) |
| 2 | The port hands lines one at a time; the adapter reads a block at a time | [`phase-2.md`](./phase-2.md) |
| 3 | Memory measured, docs, gates | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision | Why |
| --- | --- |
| A per-line callback on the port, not an array or an async iterator | an array keeps every line; a callback keeps nothing and costs least in the bundle |
| Read from the handle already stat'd, not `createReadStream(path)` | a path can name another file by the time it is opened again |
| Split on byte `0x0a` by hand, not `readline` | `readline` breaks on a lone `\r`, emits an unterminated last line and gives no byte offsets |
| Decode each line alone with `Buffer.toString`, not `TextDecoder` | `TextDecoder` strips a BOM on each call; `0x0a` is never inside a UTF-8 sequence, so per-line decoding equals whole decoding |
| Block size a constructor parameter, 1 MiB by default | tests reach every boundary with a few bytes; 1 MiB keeps a 400 MB tail to some 400 reads |
