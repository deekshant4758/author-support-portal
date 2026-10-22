# BookLeaf Author Support Portal

A full-stack support portal built against the supplied **Author Support & Communication Portal** assignment. Authors manage queries about their books; BookLeaf staff manage tickets with AI classification, priority suggestions and editable response drafts.

The bundled dataset contains all **10 authors and 18 books**. Seeded conversations and staff accounts are demo fixtures.

## Run locally

Use Node.js 20+ and npm. Run the backend and frontend in separate terminals.

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run setup
npm run dev
```

`setup` generates the Prisma client, creates the SQLite schema and seeds the database. **The seed deletes existing application records before inserting demo data. Run setup only for a fresh demo database.** For an existing database, use `npm run prisma:generate` and `npm run db:push` without seeding. Do not overwrite an existing `.env`.

```powershell
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs on port 4000. Vite proxies `/api` to the backend.

In `backend/.env`, set `GROQ_API_KEY` to enable the live provider. With no key, or with `AI_ENABLED=false`, ticket creation uses classification rules and response drafting uses policy-based templates. The rest of the portal remains usable.

## Demo logins

All seeded accounts use password **`bookleaf123`**. Credentials are documented here and are not displayed or prefilled in the login page.

The default form is **Author sign in**. Use the **Admin login** button below it for staff access.

| Role | Email | Useful scenario |
| --- | --- | --- |
| Admin | `admin@bookleaf.in` | Full ticket management |
| Admin | `raghav@bookleaf.in` | Assignment to another staff member |
| Admin | `siddharth@bookleaf.in` | Additional staff account |
| Author | `priya.sharma@email.com` | Published books and pending royalties |
| Author | `rohit.kapoor@email.com` | Multiple books |
| Author | `ananya.reddy@email.com` | Single-book account |
| Author | `vikram.joshi@email.com` | Multiple books |
| Author | `meera.nair@email.com` | Distribution support example |
| Author | `arjun.malhotra@email.com` | Single-book account |
| Author | `sneha.kulkarni@email.com` | Published and production books |
| Author | `farhan.sheikh@email.com` | Single-book account |
| Author | `kavita.deshmukh@email.com` | Production book with zero royalties |
| Author | `diya.chatterjee@email.com` | Multiple books |

## Portal behavior

**Authors** see an overview with sales and royalty totals, recent tickets, production progress and expandable quick answers. My Books includes the required title, ISBN, genre, publication date, status, MRP, copies sold and earned/paid/pending royalties, plus available distribution details. Missing dates and zero values are supported.

Submitting a query requires a book dropdown (including General / Account Level), subject and description. An optional attachment stores its filename and size only; the file is not uploaded. My Tickets supports search, status filters and pagination. A ticket shows the original query and public conversation. Authors can reply, reopen a resolved ticket by replying, and close their own ticket.

**Admins** have a queue with status, category, priority, assignee, date and search filters. Urgency ordering places unresolved tickets first, then priority and age. Overdue indicators use configured demo targets, not a promise of a customer response time.

Opening an admin ticket automatically loads one suggested draft. Staff can edit it, regenerate it with a tone or instructions, move it into the reply box, and explicitly send it. A failed draft request leaves manual replies available. Staff can override classification and priority, change status, assign themselves or another staff member, and add private notes.

Public replies update the owning author's conversation through Server-Sent Events (SSE). An author's own reply produces a send confirmation; only a public staff reply produces “BookLeaf replied to your ticket.” Internal notes stay on admin streams.

The full knowledge base is server-side AI context. There is no knowledge-base or analytics page in either portal. Only two useful FAQ answers are returned to authors for inline reading.

## Architecture

```text
frontend/   React + TypeScript + Vite + Tailwind + TanStack Query
backend/    Express + TypeScript + Zod + Prisma + SQLite
            REST /api/v1 + role-scoped SSE
            Server-only Groq client, prompts, retrieval, rules and templates
```

React keeps remote data in TanStack Query; live events invalidate affected queries. Express handles authentication, role checks and validation before service work. Prisma models users, authors, books, tickets, messages, ticket events and actual AI usage.

SQLite keeps the assignment easy to run locally. PostgreSQL would suit a shared production deployment; that requires changing the Prisma provider and preparing migrations, not just changing the database URL.

Passwords are hashed with bcrypt. Protected API requests require a JWT and enforce author ownership on the server. Staff-only operations reject author sessions. The browser stores the session token locally; the native EventSource connection passes it as a query parameter, which application request logs redact. Environment files and local databases are ignored by Git.

## AI integration

- **Model choice:** Groq is used through its OpenAI-compatible HTTP API. The configured smaller model, `openai/gpt-oss-20b`, handles bounded structured classification; `openai/gpt-oss-120b` handles natural-language drafts. Separate environment settings allow changing either model without changing the portal.
- **Classification:** the subject, a bounded description and relevant book facts produce a category, priority, confidence and brief rationale. Categories and priorities are checked before persistence. Admin overrides preserve the original suggestions for review.
- **Grounding:** the assignment's BookLeaf policies are split into tagged sections. Drafting retrieves up to three relevant sections, includes real book figures and at most two recent public messages, and requests an empathetic reply with a clear next step. Private notes are excluded. Prompts also describe the implemented portal's limits so replies do not direct authors to nonexistent bank-editing or per-platform sales controls.
- **Failure handling:** timeouts, rate limits, invalid output and provider errors fall back to deterministic rules or templates. Drafts are always reviewed by staff; nothing is sent automatically.
- **Cost control:** classification output is capped at 300 tokens; drafting at 700. Input text/history is bounded. Classification is cached for 30 minutes and drafts for 15 minutes, with draft keys including the last public message, category, priority and generation options. In-memory caches are bounded. AI endpoints are rate-limited.
- **Usage:** real model tokens, latency, cache/fallback status and estimated cost are recorded internally. Pricing settings are estimates maintained by the operator. No invented usage is seeded and no token/cost telemetry is presented in the portal.

## API documentation

With the backend running:

- [Swagger UI](http://localhost:4000/api/docs)
- [OpenAPI JSON](http://localhost:4000/api/openapi.json)
- [Health endpoint](http://localhost:4000/health)

Business routes use `/api/v1`. Except login, they require `Authorization: Bearer <token>`. The SSE route accepts `?token=<token>` instead.

| Method | Path | Access and purpose |
| --- | --- | --- |
| POST | `/auth/login` | Sign in |
| GET | `/auth/me` | Current authenticated user |
| POST | `/auth/logout` | Client discards the session token |
| GET | `/authors/me` | Author profile, complete catalogue, totals and recent tickets |
| GET | `/books` | Own books; admins may filter by `authorId` |
| GET | `/books/:id` | Book details with ownership checks |
| GET | `/tickets` | Scoped, filtered and paginated ticket list |
| POST | `/tickets` | Author creates a query |
| GET | `/tickets/:id` | Conversation; authors receive public messages only |
| PATCH | `/tickets/:id` | Admin status, category, priority or assignment |
| POST | `/tickets/:id/messages` | Public reply; admins may set `isInternal` |
| POST | `/tickets/:id/close` | Author closes own ticket; admins may close any ticket |
| POST | `/tickets/:id/assign` | Admin assigns or unassigns |
| POST | `/tickets/:id/ai/draft` | Admin requests an editable response suggestion |
| POST | `/tickets/:id/ai/reclassify` | Admin reruns classification |
| GET | `/admin/stats` | Admin queue statistics |
| GET | `/admin/team` | Staff assignment options |
| GET | `/admin/authors` | Admin author list |
| GET | `/admin/ai/usage` | Internal usage records |
| GET | `/knowledge-base` | Admin-only policy context, no portal page |
| GET | `/knowledge-base/answers` | Authenticated inline FAQs |
| GET | `/events` | Role- and author-scoped event stream |

Ticket detail and mutation routes accept either an internal ID or the public ticket reference. List parameters include `status`, `category`, `priority`, `assignee`, `dateFrom`, `dateTo`, `search`, `sort`, `page` and `pageSize`; see Swagger for allowed values. Responses use `{ data, meta? }` or `{ error: { code, message, details? } }`.

## Verification

```powershell
cd backend
npm test
npm run build
```

The backend suite creates and seeds temporary databases, leaving the development database untouched. It covers all sample records, ownership/RBAC, validation, fallback AI, concurrent submissions, drafts, overrides, assignment, private notes, lifecycle, pagination beyond 500 tickets, overdue counts and scoped live events.

```powershell
cd frontend
npx playwright install chromium
npm test
npm run build
```

Alternatively, use installed Chrome on Windows:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm test
```

Browser tests use isolated API/EventSource fixtures. They cover role-specific login, empty credential fields, inline keyboard-accessible FAQs, mobile layouts, reply notifications, automatic editable drafts, manual replies after draft errors, query validation, book edge cases and pagination. They complement the backend integration tests; they are not a deployed end-to-end test.

The latest local audit passed **18 backend tests and 9 browser tests**. A separate synthetic-data smoke check successfully called both configured Groq models. See [assignment audit](docs/ASSIGNMENT-AUDIT.md) and the [one-page approach write-up](BRIEF-WRITEUP.md).

## Deployment and limitations

A live URL and public repository visibility have **not been verified**. They remain submission deliverables; no deployment URL is invented here.

For a deployment, build both applications, run the compiled backend with `npm start`, serve `frontend/dist` with SPA route fallback, configure `CLIENT_ORIGIN`, a strong `JWT_SECRET` and the server-only Groq key, and use persistent database storage. For separate frontend/API origins, set `VITE_API_URL` (including `/api/v1`) before building the frontend. Ensure the proxy supports SSE without response buffering.

Known limits:

- Attachments are UI-only filename references, as allowed by the assignment. There is no file storage, finance integration, bank editor, actual payout/reprint automation or email notification service.
- The supplied dataset has aggregate sales/royalties, without per-platform transaction figures. No platform breakdown is fabricated.
- Demo support conversations are synthetic; production stages derive from book status. The seed does not invent bank details, paid-package membership or production delay explanations.
- AI suggestions need staff review and cannot guarantee classification or response accuracy. External actions described in a reply require staff to carry them out.
- SQLite, caches and SSE subscribers are local to one backend instance. Production scaling needs a shared database/event transport, durable job handling and missed-event recovery.
- Session expiry, password recovery and token revocation need a fuller production authentication flow.
