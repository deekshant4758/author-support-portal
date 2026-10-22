# Assignment audit

Reviewed against the supplied **Author Support & Communication Portal** PDF, including the requirements on pages 2–4, BookLeaf policies on pages 5–7, and submission requirements on page 8.

## Requirement coverage

| Requirement | Implementation and verification |
| --- | --- |
| Email/password login; author data isolation | JWT authentication and server-side ownership/RBAC checks. Tests reject anonymous users, another author's books/tickets, staff-only actions and an account without an author profile. Login defaults to authors, with a separate staff form. |
| All required book fields | My Books includes title, ISBN, genre, publication date, status, MRP, copies sold and royalties earned/paid/pending. Production, missing-date and zero-royalty cases are covered. |
| Query form | Book dropdown with General / Account Level, subject, description and optional filename/size reference. Frontend and API validation are tested. Actual uploads are optional in the assignment and are not implemented. |
| Author ticket list, original query and replies | Search, status filtering, pagination, original query, public conversation, reply and close flow. Replying reopens a resolved ticket. |
| Live replies | Scoped SSE refreshes the owning author's view. Tests verify public staff replies, private-note isolation and notification behavior. |
| Admin queue filters and urgent/old unresolved work | Status, category, priority, date, search and assignee filters. Urgency ordering puts unresolved work first, then priority and age. Pagination is tested with more than 500 tickets. |
| AI classification and priority with overrides | Structured live model output is validated. Rules handle provider failure. Staff can override both values and retain an audit history. |
| Draft presented when opening a ticket | One automatic request per opened ticket, including development StrictMode. Editable draft, regeneration and explicit sending are tested. Manual replies remain usable when generation fails. |
| Status, internal notes and self-assignment | Admin controls and API integration tests cover these actions. Notes do not alter the public reply time and are restricted to admin streams. |
| REST, authentication, RBAC, validation and errors | Consistent `/api/v1` routes, meaningful validation/ownership errors, Swagger at `/api/docs` and JSON at `/api/openapi.json`. Ticket references and internal IDs both resolve. |
| Grounded prompts and secret handling | Server-only Groq configuration; retrieved policy context, bounded public history and real book facts. Prompts describe unavailable portal controls and prohibit invented facts. |
| AI failure/cost/model justification | Rules/templates, timeouts, retries, bounded prompts, output caps, caches and internal usage recording. Model choices and limits are explained in README. |
| Provided dataset | Temporary-database tests compare all 10 authors and all 18 books with the bundled JSON. No development database reseeding was performed during the audit. |
| README and brief write-up | Updated setup, demo credentials, architecture, AI, API and limitations in README; added `BRIEF-WRITEUP.md`. |
| Public repository, collaborator and live URL | **Unverified / outstanding.** The local audit does not establish repository visibility, the requested collaborator or a reachable deployment. The assignment says the collaborator address will be provided separately. |

## Corrections made

- Removed knowledge-base and analytics pages, API-resource navigation, invented service claims, account/triage detail on author screens and redundant status/marketing pills. Kept task-relevant ticket status and admin priority indicators.
- Kept credentials in README only. Author sign-in appears first, with an Admin login button below the form.
- Quick-answer questions expand their answers in place and do not open the query form.
- Fixed the false “BookLeaf replied” toast on an author's own message. Only public staff messages trigger that notification.
- Restored the required query book dropdown and the full production catalogue on the author dashboard, including books with no tickets.
- Fixed an ownership gap for author accounts without linked profiles, private-note live-event leakage, public ticket-number lookup, reverse date ranges, queue truncation beyond 500 rows, overdue counts across priorities and simultaneous-submission ticket references.
- Added automatic editable admin drafts; removed unnecessary model/confidence/token/cost detail from the frontend.
- Corrected fallback guidance about nonexistent bank controls, metadata update times and unverified production dates. Removed invented seed bank details, paid-plan inference, production explanations and usage records.
- Redacted event-stream tokens from application request logs and routed asynchronous stream setup errors through API error handling.

## Verification and limits

Passed locally: **18 backend tests and 9 Chrome browser tests**, plus both production builds. Backend tests use temporary seeded SQLite databases. Browser tests use API and EventSource fixtures and include keyboard and mobile checks; they do not prove a public deployment works.

A separate live-provider smoke test with synthetic inputs successfully returned classification from `openai/gpt-oss-20b` and a policy-grounded draft from `openai/gpt-oss-120b`. This verifies connectivity and a representative request, not universal response quality.

The full knowledge base is AI context, as specified in the assignment, rather than an author-facing feature. Aggregate sales data is preserved without fabricating per-platform transactions. Attachments remain UI-only, and external business actions require staff execution. Deployment and public submission deliverables remain unverified.
