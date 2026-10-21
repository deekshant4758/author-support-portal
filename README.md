# BookLeaf — Author Support & Communication Portal

A full-stack author support desk for BookLeaf Publishing: authors raise queries against their
books and see replies live; the operations team works a prioritised queue with AI triage and
grounded, editable response drafts.

Built for the "Author Support & Communication Portal" assignment using the provided sample
dataset (10 authors, 18 books) and the BookLeaf knowledge base.

---

## 1. What is included

**Author portal**

- Email/password login (JWT), scoped to the signed-in author only.
- Overview dashboard: royalty totals, settlement progress, catalogue state, open threads,
  account snapshot, production stage for in-flight titles.
- **My Books**: every title with ISBN, genre, publication date, status, MRP, copies sold,
  royalty earned/paid/pending, channels, print partner and production stepper.
- **Submit a query**: book selector (or general/account-level), subject, description, category
  (auto or manual), attachment (UI-only, metadata stored), live AI triage feedback.
- **My Tickets** and ticket detail: full conversation, live updates over SSE without a refresh,
  reply as author, close/resolve handshake, SLA state.

**Operations portal**

- **Ticket queue** across all authors: filters (status, category, priority, assignee, date,
  search), urgency-first sorting, SLA breach/age cues, pagination.
- **Ticket console**: author + book context, conversation and internal notes, AI copilot panel
  (category, confidence, priority reason), admin overrides, assignment, status controls,
  AI draft studio (tone, history toggle, instructions), editable draft, copy/discard/use-in-reply,
  send reply or private internal note, audit/event log.
- **AI & Analytics**: queue health, category/priority mix, SLA, AI usage/cost telemetry,
  fallback and cache rates.
- **Knowledge base**: browse the exact policy sections the AI is grounded on, with retrieval
  keywords and the guardrails used.

**AI layer**

- Automatic category + priority triage on ticket creation.
- Retrieval-grounded draft generation for admins (never auto-sent).
- Admin can override category/priority and re-run triage.
- Graceful degradation: rule-based triage and grounded template drafts when Groq is missing,
  rate-limited or down. Tickets are still created and can always be answered manually.
- TTL caching, token/cost telemetry per call, prompt-size limits and retry/backoff.

---

## 2. Stack and structure

```
author-support-portal/
├── backend/                 # Express + TypeScript REST API
│   ├── prisma/schema.prisma # SQLite schema (Postgres-ready)
│   ├── src/
│   │   ├── config/          # env validation (zod)
│   │   ├── middleware/      # auth, RBAC, validation, errors, rate limits
│   │   ├── services/        # ticket logic, event bus, AI layer
│   │   ├── routes/          # auth, authors, books, tickets, admin, knowledge, SSE
│   │   ├── docs/openapi.ts  # OpenAPI 3 spec served at /api/docs
│   │   ├── validation/      # zod request schemas
│   │   └── seed.ts          # loads the provided sample dataset
│   └── tests/ai.test.mts    # AI unit/integration tests (no network, no Groq key)
└── frontend/                # React 18 + Vite + TypeScript + Tailwind
    └── src/{pages,components,store,lib}
```

**Backend:** Node.js + Express 4 + TypeScript, Prisma 6, SQLite (zero-setup local DB), zod,
JWT, helmet, CORS allow-list, morgan, express-rate-limit, Swagger UI.

**Frontend:** React 18, React Router, TanStack Query, Tailwind CSS, SSE via `EventSource`.
No component library — a small design system (`components/ui.tsx`) keeps the BookLeaf visual
language consistent and avoids heavy dependencies.

**Why this stack:** the assignment scores schema/API design over the specific database. SQLite
with Prisma gives a one-command local setup and an easy switch to PostgreSQL for deployment;
TypeScript on both sides keeps the API contract honest; TanStack Query + SSE provide caching,
retries and live updates with very little custom state code.

---

## 3. Run locally

Prerequisites: Node.js 20+ (developed on Node 22), npm.

### Backend

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
# edit .env and set GROQ_API_KEY (leave empty to run in deterministic fallback mode)
npm run setup               # prisma generate + db push + seed
npm run dev                 # http://localhost:4000
```

`npm run setup` seeds the 10 authors / 18 books from the provided dataset plus a realistic
ticket history. `npm run db:reset` rebuilds the database from scratch.

### Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Vite proxies `/api` to `http://localhost:4000`. For a split deployment set
`VITE_API_URL=https://your-api.example.com/api/v1` (see `frontend/.env.example`) and add the
frontend origin to `CLIENT_ORIGIN` on the API.

### Demo accounts — password `bookleaf123`

| Role | Email | Notes |
| --- | --- | --- |
| Admin / ops lead | `admin@bookleaf.in` | Pooja Mehta, full queue + AI console |
| Admin / production | `raghav@bookleaf.in` | Second specialist for assignment tests |
| Author | `priya.sharma@email.com` | 2 titles, live + pending royalty, open thread |
| Author | `meera.nair@email.com` | Distribution/unavailable listing case |
| Author | `sneha.kulkarni@email.com` | Title in production (live stepper) |
| Author | `arjun.malhotra@email.com` | Zero-royalty / early-stage catalogue edge case |

All ten authors from the dataset can sign in with the same password
(`ananya.reddy@`, `diya.chatterjee@`, `farhan.sheikh@`, `kavita.deshmukh@`,
`rohit.kapoor@`, `vikram.joshi@` + `email.com`).

### Useful endpoints

- API health: `http://localhost:4000/health`
- Swagger UI: `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/docs.json`

---

## 4. Architecture

```
React SPA ──REST /api/v1──► Express (JWT auth → RBAC → zod validation → routes)
   │                              │
   └──── SSE /api/v1/events ◄──── event bus (per-author + admin channels)
                                  │
                     ticket service ──► Prisma ──► SQLite / Postgres
                                  │
                          AI orchestration
                     (triage → retrieval → draft)
                                  │
                             Groq API (server-only key)
```

**Request flow for a new ticket**

1. `POST /tickets` authenticates the author, validates input and loads the selected book.
2. `classifyTicket()` asks Groq for strict JSON (category, priority, confidence, reason). On any
   failure it uses the weighted rule engine. The ticket is **always created**.
3. Ticket + first author message + system acknowledgement + triage audit event are persisted in
   one Prisma write.
4. `ticket.created` is published to the SSE bus (author channel + admin channel).
5. The admin console opens the ticket, calls `POST /tickets/:id/ai/draft`. The drafter retrieves
   2–3 relevant knowledge sections, builds a compact prompt, and returns an editable draft with
   token/cost metadata. Nothing is sent automatically: the admin edits and submits a message.

**Database (Prisma):** `User` (role `AUTHOR`/`ADMIN`, 1:1 optional `Author`), `Author`, `Book`,
`Ticket` (category/priority plus AI originals for override tracking), `Message`
(`AUTHOR`/`ADMIN`/`SYSTEM`, `isInternal`), `TicketEvent` (audit trail, AI metadata),
`AiUsage` (operation, model, tokens, latency, cost, fallback/cache flags).

**Security:** passwords hashed with bcrypt; JWT in `Authorization: Bearer`; `authenticate`
and `requireAdmin`/`requireAuthor` middleware on every protected route; ownership checks in the
ticket service (authors only see their own tickets/books); internal notes filtered out of author
payloads **and** out of the author SSE stream; helmet, CORS allow-list, body limits, login and AI
rate limits; no secrets in the frontend; `.env` git-ignored.

**Errors:** a typed `AppError` plus a single error middleware return a consistent envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "subject": ["…"] } } }
```

---

## 5. Real-time updates

Server-Sent Events (`GET /api/v1/events?token=…`) push `ticket.created`, `ticket.updated`,
`ticket.message` and `ticket.closed`. The event bus keeps one connection per client, scopes
events by author id, and sends a heartbeat so proxies do not close idle streams. The frontend
reconnects with backoff, invalidates the relevant TanStack Query caches and shows a "Live sync"
indicator. Internal notes are never emitted to the author's channel.

---

## 6. AI integration

### Models

| Job | Default model | Why |
| --- | --- | --- |
| Triage (classification + priority) | `openai/gpt-oss-20b` on Groq | Small, cheap and fast; structured JSON-only task |
| Drafting | `openai/gpt-oss-120b` on Groq | Better tone/instruction following for author-facing prose |

Both are configurable via `GROQ_MODEL_CLASSIFY` / `GROQ_MODEL_DRAFT`. Groq's OpenAI-compatible
API means the same client works with any compatible provider by changing `GROQ_BASE_URL`.

### Prompt strategy

- **Triage system prompt** contains the exact six categories, an explicit priority rubric with
  BookLeaf-specific examples (overdue royalty, ISBN mismatch, unavailable listing), and rules to
  return strict JSON only. Confidence must be a real 0–1 estimate, not a constant.
- **Draft system prompt** encodes the BookLeaf voice: empathy first, own mistakes, be concrete,
  never invent amounts/dates, commit to a 48-hour follow-up, ask only for the minimum missing
  information, 120–220 words, plain text with `Hi <first name>,` … `Warmly, BookLeaf Author
  Support`, and no mention of AI.
- **Grounding:** account facts (title, ISBN, MRP, copies sold, royalty earned/paid/pending,
  production stage, tier, city) and retrieved policy extracts are passed as context; the prompt
  explicitly forbids claims outside them.
- **Tone modes:** Empathetic (default), Concise, Escalation; admins can add short instructions.
- **Human in the loop:** drafts are never auto-sent. The event log records `DRAFT_GENERATED`
  with model and source, and the UI is labelled "AI suggestion · human review required".

### Knowledge retrieval (cost control)

The knowledge base is split into small tagged sections (royalty, ISBN, printing, distribution,
production stages, tone/policies, company). For each draft the backend scores sections by
category + keyword overlap and sends only the top 3 (~500–800 tokens) instead of the whole KB.
Only the last two public messages are included by default (history toggle). Ticket text is
truncated for triage. Exact response caching keyed by ticket content + tone + instructions
prevents duplicate spend; cache hits are logged with zero tokens and zero marginal cost.

### Reliability and observability

- 15 s timeout, one retry with jittered backoff on 429/5xx/timeouts, automatic one-time retry
  without `response_format` if the model rejects JSON mode.
- Invalid JSON, unknown category/priority or an empty completion are treated as failures.
- Every failure falls back: **rule engine** for triage (weighted phrases + account signals) and
  **grounded template** for drafts (policy-accurate, real numbers, no invented facts).
- `AiUsage` stores model, operation, tokens, latency, estimated USD cost, success, fallback and
  cache flags; `/admin/ai/usage` and **AI & Analytics** surface totals and fallback rate.
- API keys live only in `backend/.env`; requests to Groq happen only on the server.

### Tests

```bash
cd backend
npm test          # 7 tests: heuristics, AI JSON parsing, invalid-AI fallback, draft cost, template fallback
npm run typecheck
```

---

## 7. API reference

Base URL: `/api/v1`. Protected routes need `Authorization: Bearer <jwt>`.
OpenAPI/Swagger is generated in `backend/src/docs/openapi.ts` and served at `/api/docs`.

### Auth

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | public (rate-limited) | Email/password login, returns JWT + user |
| GET | `/auth/me` | any | Current user + author profile |
| POST | `/auth/logout` | any | Stateless logout acknowledgement |

### Author portal

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/authors/me` | author | Profile, stats, bank details |
| GET | `/books` | author | Own catalogue (+ admin can pass `authorId`) |
| GET | `/books/:id` | owner/admin | Book detail + royalty breakdown |
| POST | `/tickets` | author | Create ticket; AI triage in `meta.triage` |
| GET | `/tickets` | any | List; authors are scoped to their own tickets |
| GET | `/tickets/:id` | owner/admin | Thread, messages, events, book, SLA |
| POST | `/tickets/:id/messages` | owner/admin | Public reply or admin internal note |
| POST | `/tickets/:id/close` | owner/admin | Close ticket |
| GET | `/knowledge` | any | Knowledge base sections used for grounding |
| GET | `/events` | any (token) | SSE stream scoped by role |

### Operations portal

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| PATCH | `/tickets/:id` | admin | Status, category, priority, assignee overrides |
| POST | `/tickets/:id/assign` | admin | Assign to a specialist (`"me"` for self) |
| POST | `/tickets/:id/ai/draft` | admin | Generate grounded draft (tone/history/instructions) |
| POST | `/tickets/:id/ai/reclassify` | admin | Re-run AI triage, discarding overrides |
| GET | `/admin/stats` | admin | Volume, SLA, category/priority mix, AI metrics |
| GET | `/admin/team` | admin | Specialists + assignment load |
| GET | `/admin/authors` | admin | Author directory with counts |
| GET | `/admin/ai/usage` | admin | Recent AI calls and costs |

Ticket endpoints accept either the internal id or the public ticket number (`TKT-####`).
List filtering: `status`, `category`, `priority`, `assignee`, `dateFrom`, `dateTo`, `search`,
`sort=urgency|oldest|newest|updated`, `page`, `pageSize`.

**Rate limits:** login 20/15 min, writes 120/min, AI draft 20/5 min per IP.

---

## 8. Deployment notes

The repo is split into independent `backend/` and `frontend/` apps (no workspace coupling).

1. **Database:** set `DATABASE_URL`. On a managed Postgres, change the Prisma provider to
   `postgresql`, run `npx prisma migrate deploy` (or `db push`) and `npm run db:seed`.
2. **Backend:** deploy `backend/` (Render/Railway/Fly/VPS). Set `JWT_SECRET`, `CLIENT_ORIGIN`
   (the deployed frontend origin), `GROQ_API_KEY`, and `NODE_ENV=production`; run `npm run build`
   and `npm start`. SQLite on ephemeral filesystems will lose data — use Postgres for a live demo.
3. **Frontend:** deploy `frontend/` to Vercel/Netlify. Set `VITE_API_URL` to the API base
   (`https://…/api/v1`) at build time. The app uses same-origin `/api/v1` when unset.
4. SSE works through most platforms; if a proxy buffers responses, disable buffering for
   `/api/v1/events`.

A live demo URL is not included in this repository; deploy steps above produce one without code
changes. All demo data is seeded from the provided JSON.

---

## 9. Trade-offs, limitations and next steps

- **SQLite by default** keeps setup one command; production should use Postgres (schema is
  provider-agnostic apart from the provider line).
- **SSE + in-process event bus** is enough for a single instance. Horizontal scaling needs a
  shared pub/sub (Redis) for events and the AI cache.
- **Attachments are UI-only** (name + size metadata), as the brief allows. Real uploads would use
  signed S3/R2 URLs with virus scanning.
- **No email notifications** yet; the portal is the source of truth. Transactional email for
  "desk replied" is the obvious next step.
- **Auth is deliberately simple** (email/password, 8 h JWT). Production would add refresh tokens,
  password reset, SSO for staff and audit-log immutability.
- **Knowledge retrieval is lexical** (category + keyword scoring). With more documents, move to
  embeddings + pgvector with the same interface.
- **AI cost controls** are TTL caches, compact prompts, top-3 retrieval and per-call telemetry;
  a production system would add org-level budgets and prompt-version tracking (partial in
  `AiUsage`/event metadata already).
- **Author “reply” behaviour** reopens resolved tickets automatically; the exact SLA policy is
  configurable in `lib/constants.ts`.

See `BRIEF-WRITEUP.md` for the one-page approach summary.
