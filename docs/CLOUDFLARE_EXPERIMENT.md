# Cloudflare Pages + Workers + D1 — experimental migration

## Safety boundary
This branch is an isolated proof of concept. No production deploy, migrations, user-data transfer or paid resource creation is authorized. The existing Fastify/PostgreSQL/Supabase deployment is unchanged.

## Initial implementation
- Independent Worker with a read-only health endpoint and **fail-closed** 503 for all other routes.
- D1 migration for a per-user credit ledger and projects, with optimistic revision columns.
- No user authentication has been ported. The D1 schema alone does **not** provide access control.
- No real database ID or secret is committed.
- No Cloudflare resources are created or deployed.

## Why not switch the frontend yet?
The existing web application depends on authenticated `/api` endpoints for projects, sessions and private media. Routing it to the scaffold would break login and saving. A separate preview must not replace the live API.

## Next implementation gates
1. Implement cookie/session authentication with Web Crypto and strong password hashing compatible with existing accounts, or a securely verified migration strategy. Never ship a mock identity or trust a client-provided user ID.
2. Port user-scoped projects, revisions, credits and conflict detection; test unauthorized access and cross-user isolation.
3. Design media storage separately: D1 is for metadata, **not** video binaries. Prefer IndexedDB / explicit local file handling initially; private cloud media requires a separate cost/risk review.
4. Add tests with local D1 and Miniflare/Wrangler; measure CPU, database reads/writes and request counts.
5. Create an isolated Cloudflare preview only after explicit approval, confirming free-tier eligibility and no billing risk.
6. Validate mobile behavior and backups before considering a production cutover.

## Local-only workflow (after adding compatible dev dependencies)
- Install the Wrangler CLI as a **dev dependency** after checking its current version and licensing.
- Run `wrangler d1 migrations apply nexocena-experimental --local` from `apps/worker` with an isolated local D1 database.
- Run `wrangler dev --local`; `GET /api/health` should return `productionReady:false`.
- Other routes intentionally return HTTP 503.

**Do not** run `wrangler deploy`, `wrangler d1 create`, `wrangler d1 migrations apply --remote` or publish Pages as part of this stage.
