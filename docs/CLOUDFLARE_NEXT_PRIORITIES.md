# Cloudflare experiment — next priorities

## Implemented in source
- Same project validation as the Fastify backend via the shared Zod projectSchema.
- Worker endpoints now accept the existing frontend contract: POST /api/projects, PUT /api/projects/:id with {revision,data}, DELETE returns 204.
- Experimental registration creates a session cookie so the existing React login flow can continue.
- Per-user D1 sessions, projects and manual Google Flow credits with CAS revision checks.
- D1-backed authentication attempt throttling (10 attempts/15 minutes per hashed email+IP bucket).
- HTTPS cross-origin requests fail CSRF checks; all non-GET routes require x-nexocena.
- Remote hostnames return 503 unless EXPERIMENT_REMOTE_ENABLED=true (never enable without separate review).
- GET /api/media returns [] because binary storage is intentionally not implemented.
- Browser credit updates are serialized; backup localStorage keys are separated by account.
- Tests use in-memory SQLite, applying the same 0001/0002/0003 D1 migrations.

## Validation
The GitHub CI is configured to run npm run typecheck:worker and npm run test:worker on Node 24, in addition to existing build and tests. Check workflow results before claiming successful compilation or runtime behavior. Local SQLite tests are NOT a substitute for actual workerd/Wrangler tests.

## Limitations and release blockers
1. Do not enable remote Worker routes until PBKDF2 310k CPU use has been benchmarked against Workers Free restrictions and security reviewed.
2. Existing scrypt password hashes are not compatible: do not migrate real users/sessions without a separately tested migration.
3. Binary media upload, scene approval with media references, paid video generation and MP4 assembly remain unavailable.
4. D1 throttling is basic: threat-model account lockouts and rotating-IP abuse before exposing authentication publicly.
5. Do not reuse production cookies/origins for previews. Work on a separate experimental origin only.
6. No production deployment, D1 remote migration, Cloudflare resource creation or billing change was authorized.
7. The old browser-wide credit backup is NOT automatically migrated to per-user storage; users should import a manual JSON backup if needed.
8. Frontend draft recovery, media UX and session lifecycle require further tests before user acceptance.

## Commands (local Node 24)
- npm ci
- npm run typecheck:worker
- npm run test:worker
- npm run typecheck && npm test && npm run build
- Wrangler D1 migrations and integration tests with --local only (after setting up local tooling).

Do not merge this branch into main or deploy anything until homologation.
