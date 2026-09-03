# Stack heuristics

Mapping rules from checklist signals to recommended stack families. Use these when proposing candidates in action 02. Heuristics, not laws - override when audit (action 03) flags a conflict.

## Architecture pattern

| Signal (from checklist)                                                | Pattern                |
| ---------------------------------------------------------------------- | ---------------------- |
| Solo or 2-dev team, < 10k users, < 5 features, no real-time            | **Monolith**           |
| Mid-size team, growing features, want clean modules                    | **Modular monolith**   |
| Many decoupled domains, each with its own scaling profile              | **Microservices**      |
| Bursty traffic, low ops budget, short-lived requests, no persistent connections | **Serverless**  |
| Real-time + low latency required + WebSockets                          | **Monolith / serverless edge** (avoid pure microservices) |

## Front-end

| Signal                                                            | Recommendation                    |
| ----------------------------------------------------------------- | --------------------------------- |
| SEO important + content-heavy                                     | **Next.js SSR** or **Astro SSR**  |
| SEO not important + interactive dashboard                         | **Vite + React SPA**              |
| Mobile native required                                            | **React Native / Expo** + web app |
| Marketing site + product app                                      | **Astro (marketing) + Next.js (app)** or **Next.js everything** |
| Offline-first (PWA, local sync)                                   | **Next.js + service worker** or **RxDB-based stack** |

## Back-end

| Signal                                                            | Recommendation                    |
| ----------------------------------------------------------------- | --------------------------------- |
| Team knows TypeScript, no exotic perf needs                       | **Next.js API routes** or **NestJS** |
| Team knows Python, ML/data-heavy                                  | **FastAPI**                       |
| Team knows Go, high-throughput backend                            | **Echo / Fiber**                  |
| Real-time chat, websockets, live sync                             | **Node + Socket.io** or **Phoenix (Elixir)** |
| Heavy compute (video, ML inference)                               | **FastAPI + worker queue (Celery / BullMQ)** |

## Database

| Signal                                                            | Recommendation                    |
| ----------------------------------------------------------------- | --------------------------------- |
| Relational data, transactions, GDPR                               | **PostgreSQL** (Supabase, Neon, RDS) |
| Document-shaped data, schema fluctuates often                     | **MongoDB** or **Postgres JSONB**    |
| Existing Airtable as source of truth                              | **Airtable SDK + Postgres cache layer** |
| Search-heavy (full-text, faceted)                                 | **Postgres + tsvector** OR **Postgres + Meilisearch** |
| Real-time pub/sub                                                 | **Supabase Realtime** or **Redis pub/sub** |
| Event sourcing                                                    | **Postgres + outbox pattern**       |

## Auth

| Signal                                                            | Recommendation                    |
| ----------------------------------------------------------------- | --------------------------------- |
| Next.js + Postgres                                                | **NextAuth (Auth.js)**            |
| Need polished UI, magic links, OAuth, no time to build            | **Clerk**                         |
| Already on Supabase                                               | **Supabase Auth**                 |
| Enterprise SSO required                                           | **Auth0** or **WorkOS**           |
| B2B with org-level access control                                 | **Clerk Organizations** or **WorkOS** |

## Hosting

| Signal                                                            | Recommendation                    |
| ----------------------------------------------------------------- | --------------------------------- |
| Next.js + low ops budget                                          | **Vercel**                        |
| Solo dev + Postgres + bootstrap budget                            | **Vercel + Supabase** or **Railway** |
| Heavy backend, custom infra                                       | **AWS (ECS / Fargate)** or **GCP Cloud Run** |
| EU data residency required                                        | **Scaleway**, **OVH**, or AWS eu-west-3 |
| Self-hosted preference                                            | **Coolify** or **Dokku** on VPS   |

## Conflicting-signal triage

When two signals push to different stacks, prioritize in this order:

1. **Data sensitivity (GDPR/health)** - overrides hosting region preference
2. **Real-time + multi-tenant** - overrides cost preference (forces non-trivial backend)
3. **Team language expertise** - overrides "best tool" if learning curve > 2 weeks
4. **Budget** - caps everything else; prune candidates that exceed it

When still ambiguous, surface the trade-off to the user in the comparison table (action 02) instead of choosing silently.
