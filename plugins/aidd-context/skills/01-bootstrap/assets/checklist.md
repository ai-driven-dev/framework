# Bootstrap checklist

17 items across 4 blocks. Blocks 1-3 are filled by user input (action 01). Block 4 is derived and validated across actions 02 and 04.

## 📌 Block 1 — Project (the what)

- [ ] **Project name** — `<name>`
- [ ] **One-liner** — `<value proposition in one sentence>`
- [ ] **Type** — `<B2B SaaS | B2C | internal tool | marketplace | other>`
- [ ] **Target users** — `<profile + estimated volume at 6 months>`
- [ ] **Top 3-5 features** — `<bullet list>`
- [ ] **External integrations** — `<Slack | Stripe | Airtable | none | other>`
- [ ] **Target platform** — `<web only | web + mobile responsive | web + native iOS/Android>`

## ⚙️ Block 2 — Technical constraints (drive stack choice)

- [ ] **Real-time?** — `<yes/no — chat, live updates, websockets>`
- [ ] **Multi-tenant?** — `<yes/no — separate workspaces per customer>`
- [ ] **Data sensitivity** — `<public | business | GDPR | health/finance>`
- [ ] **Volume at 6 months** — `<active users + requests/day, order of magnitude>`
- [ ] **SEO important?** — `<yes/no — drives SSR vs SPA>`
- [ ] **Performance target** — `<p95 latency tolerated: < 200ms | < 1s | best-effort>`
- [ ] **Offline mode?** — `<yes/no — PWA, local sync>`

## 🛠️ Block 3 — Team preferences & constraints

- [ ] **Languages mastered by team** — `<list>`
- [ ] **Hosting budget** — `<bootstrap < 50€/mo | startup 50-500€ | scale-up unlimited>`
- [ ] **Hosting preference** — `<Vercel | AWS | self-hosted | "no opinion, recommend">`
- [ ] **Deal-breakers** — `<technologies excluded, e.g. "no Java", "no Mongo">`

## 🎯 Block 4 — Derived choices (output, validated by user)

- [ ] **Architecture pattern** — `<monolith | modular monolith | microservices | serverless>`
- [ ] **Front-end** — `<framework + SPA/SSR/SSG>`
- [ ] **Back-end** — `<framework + language>`
- [ ] **Database** — `<engine — choice only, not schema>`
- [ ] **Auth provider** — `<NextAuth | Clerk | Supabase Auth | Auth0 | other>`
- [ ] **Final hosting** — `<concrete: e.g. "Vercel + Supabase">`
