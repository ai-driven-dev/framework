# Stack choice guide

Reason about a stack from checklist signals - **axes to decide, not products to impose**. Never name one right answer. Any product mentioned is one illustration, never a default. When axes conflict, surface the trade-off to the user; don't choose silently.

## Decide along these axes

1. **Form factor** - what's being built? Web app, mobile (native or cross-platform), desktop, CLI, library/SDK, API-only service, data pipeline. Decides almost everything downstream; settle first.
2. **Product type** - SaaS, internal tool, marketing/content site, prototype, API product. Drives need for multi-tenancy, auth, SEO, billing.
3. **Front-end** (if any) - rendering need (server-rendered vs single-page vs static), interactivity, SEO requirement, accessibility, offline. Pick rendering model first, framework second.
4. **Back-end** (if any) - compute profile (request/response, long-running, real-time, heavy compute), team language expertise, throughput. Expertise usually beats "best tool" when learning curve is long.
5. **Tests** - which layers matter (unit, integration, end-to-end), what each must prove. Test framework follows language and layers, not fashion.
6. **Data** (if any) - persistence needed at all? Shape (relational, document, key-value, search, event log), consistency, compliance/region. "No database" is a valid, common answer.

## How to weigh conflicts

Prioritize in this order, let the rest follow:

1. **Compliance / data sensitivity** (GDPR, health) - caps hosting region and data choices.
2. **Hard functional needs** (real-time, offline, multi-tenant) - rule out incompatible options early.
3. **Team expertise** - a stack the team can't operate is the wrong stack.
4. **Budget and ops capacity** - prune anything the team can't afford to run.

## Architecture patterns (generic, language-agnostic)

Patterns, not products - applicable in any language:

- **Monolith** - one deployable; simplest to build and operate; default until a constraint forces otherwise.
- **Modular monolith** - one deployable with enforced internal module boundaries; good when team wants future extractability.
- **Microservices** - many independently deployable services; justified by independent scaling or team boundaries, not by default.
- **Serverless / functions** - per-request units; fits bursty, short-lived, low-ops workloads; avoid when long-lived connections are core.

Match pattern to real constraints (team size, scaling profile, ops budget), not trend. When ambiguous, propose two candidates and let the user choose.
