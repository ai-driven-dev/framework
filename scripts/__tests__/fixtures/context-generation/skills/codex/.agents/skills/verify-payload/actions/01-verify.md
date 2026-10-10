# 01 - Verify

Verify the bundled payload.

## Input

A request to verify the phase three fixture.

## Output

The verification code.

## Process

1. **Read.** Read [payload.txt](../assets/payload.txt) for this request; do not guess its content.
2. **Reply.** Return exactly `PAYLOAD_APPLIED:` followed by the trimmed payload, with no extra text.

## Test

| Case | Pass |
| --- | --- |
| A verification request is answered | the payload read is traced and the exact verification code is returned |
