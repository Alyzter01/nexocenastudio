# Cloudflare experimental implementation status

Branch: `experiment/cloudflare-pages-workers-d1`

## Implemented in this branch
- Experimental user registration restricted by `EXPERIMENT_REGISTRATION=true` and `EXPERIMENT_OWNER_EMAIL`. There is no external-user registration by default.
- Experimental PBKDF2-SHA256 password hashing with random salt (not compatible with the existing scrypt passwords; production identities are NOT migrated).
- Opaque session cookies, SHA-256 hashed session tokens at rest, strict same-site policy, expiry, logout and owner-derived user ID.
- User-scoped D1 projects with revision-based optimistic locking.
- User-scoped manual Flow credits with revision-based optimistic locking and separate confirmed consumption.
- Database migration `0002_auth.sql`; existing migration `0001_initial.sql` remains unchanged.

## Important caveats
- **No compilation, Wrangler run, D1 migration application or automated tests were executed.**
- This is not production-ready. In particular, PBKDF2 cost against the Workers Free CPU budget, rate limiting, exact frontend API contract and project schema validation must be validated and hardened.
- Authentication depends on environment variables; never enable public registration by default.
- Do not route existing Vercel frontend to this API until the full contract is implemented and verified.
- No Cloudflare service, billing change or deployment has been created.

## Suggested local checks when an executor becomes available
```bash
npm ci
npm run typecheck
npm test
npm run build
# Install compatible wrangler and Workers types as development dependencies,
# then apply migrations against LOCAL D1 and run Wrangler locally.
```

## Next technical requirements
- Validate and harmonize project payloads with `packages/core/src/schema.ts`.
- Test CSRF and cross-user authorization, expiry/revocation, login rate limiting and timing behavior.
- Provide a dedicated authentication strategy with demonstrated Workers Free CPU compatibility.
- Integrate preview frontend only on a separate experimental origin.
