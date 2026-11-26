# A price table is the destination's; the framework records no amount

Read before adding a cost, a price or a currency amount to telemetry.

## Decision

- The framework carries no price table and computes no amount.
- A usage record holds counters only, never a cost (`cli/src/contexts/telemetry/contract/usage-record.ts`).
- The usage contract states it: "No currency amount: the destination owns the price table."

## Why

- A price is not measurement: no file on the machine holds it, so the report would print an assertion beside facts.
- A price compiled into a released binary goes stale silently on the vendor's schedule; a stale price looks like an answer.
- Cost is per account, not per model: negotiated rates, subscriptions and bundled quotas never follow from a model name.
- It is analysis, which [measurement-may-reach-a-hosted-destination.md](measurement-may-reach-a-hosted-destination.md) assigns to the destination.

## Consequences

- A report answers in tokens and calls; whoever holds the rates finishes the calculation from the per-model counters.
- Any amount a destination shows is its own, never one the framework derived.

## Overturning this

- A vendor publishes prices the framework could fetch and version, not compile in.
- Or most supported tools start writing a real amount of their own.
