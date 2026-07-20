# 04 - Write

Write each approved lesson to the destination the user chose.

## Input

The learning plan approved by the user.

## Output

The created or updated files, and a summary table.

## Process

1. Start from the approved learning packet.
2. Apply only the destination path in [destinations](../references/destinations.md).
3. Load only the destination asset when one is required, fill it from the packet, and strip its guidance comment.
4. Apply [review protocol](../references/review-protocol.md) to touched files or handoffs.
5. Report packet, destination, action, file or handoff, and review verdict.

## Test

- Every approved lesson appears in the table.
- No packet without user approval is written or handed off.
- Each packet uses the destination chosen by the user.
- The report includes a review verdict for touched files or handoffs.
