# DECISIONS

Decisions made autonomously while building the project, with the reasoning behind each.
Newest entries are appended at the bottom of each section.

## Tooling & versions

1. **Pinned to proven major versions instead of "latest".** At build time npm's `latest`
   tags were TypeScript 7, Vite 8, Vitest 5, React Router 8, Prisma 7/8 and ESLint 10 —
   several of these are very recent majors with breaking changes (e.g. Prisma 7 requires
   driver adapters and a `prisma.config.ts`). For a reliable portfolio project the stack
   is pinned to: TypeScript 5.9, Vite 7, Vitest 3, React 19, React Router 7, TanStack
   Query 5, Tailwind CSS 4, Express 5, Prisma 6.19, Zod 3.25, ESLint 9. Upgrading is a
   deliberate, separate task.
2. **npm workspaces monorepo** (`/server`, `/client`) so one `npm install` sets up
   everything and root scripts (`npm run dev|test|seed|lint|typecheck`) fan out.
3. **npm 11 `allowScripts`.** npm 11 blocks dependency install scripts by default. Only
   the scripts that are required were approved (Prisma engines/CLI/client, esbuild,
   fsevents) and are recorded in the root `package.json`.
4. **Security audit.** `deepmerge-ts` (pulled in by the Prisma CLI's config loader) had a
   high-severity advisory; it is overridden to the patched `^8.0.2` via npm `overrides`
   and the Prisma CLI was re-verified. The remaining moderate advisory is in
   `@vitest/mocker` (dev-only test runner, fixed only in Vitest ≥ 4.1) and does not
   affect runtime code.
5. **`prisma generate` is an explicit step, not `postinstall`.** Workspace postinstall
   hooks ran before the Prisma CLI was installed. `npm run setup` / the README run
   generation explicitly.

## Database

6. **PostgreSQL via Docker Compose on host port 5440.** Ports 5432/5433 were already in
   use on the build machine (other projects), so the container maps `5440:5432` to avoid
   collisions. Docker was available, so the SQLite fallback was **not** needed.
7. **Separate test database** (`marketplace_test`), created by
   `docker/init-test-db.sql` on first container start. The test runner refuses to run if
   `TEST_DATABASE_URL` equals `DATABASE_URL`.
8. **Tests use `prisma migrate deploy` + `TRUNCATE`, not `prisma migrate reset`.**
   Prisma refuses destructive resets when invoked by an AI agent without explicit user
   consent. `migrate deploy` is non-destructive; the suite truncates all tables in the
   *test* database before each test instead.
9. **Money is stored as integer paise** (`Int`) to avoid floating-point errors. The UI
   formats with `Intl.NumberFormat('en-IN', { currency: 'INR' })`.
10. **DB-level CHECK constraints** (stock ≥ 0, price > 0, quantity > 0, rating 1–5) are
    added in a hand-written migration as defense in depth behind the service layer.

## Auth

11. **Access token in memory, refresh token in an httpOnly cookie.** Access JWTs (HS256,
    15 min, issuer/audience checked) are never persisted in `localStorage`, reducing XSS
    blast radius. The refresh token is an opaque random string stored **hashed**
    (SHA-256) and scoped to `path=/api/auth`, `SameSite=Lax`, `Secure` in production.
12. **Refresh-token rotation with reuse detection.** Every refresh revokes the presented
    token and issues a new one in the same "family"; presenting an already-rotated token
    revokes the entire family (likely theft). A compare-and-swap update prevents two
    concurrent refreshes from both succeeding. The client de-duplicates concurrent
    refreshes.
13. **Vendor authorization reads the database, not just the JWT role.** Vendor routes
    load the `Vendor` row and require `APPROVED`, so approval/rejection takes effect
    immediately even if an old access token still carries the previous role.
14. **Login timing equalisation:** unknown emails still run a bcrypt comparison against a
    dummy hash, so response time doesn't reveal which emails are registered.
15. **Vite dev proxy** (`/api`, `/uploads` → `:4000`) makes the SPA and API same-origin in
    development, so the cookie flow needs no cross-site configuration. CORS is still
    configured (`CLIENT_URL`, comma-separated) for split deployments.
16. **Rate limiting** applies to `/api/auth/register|login|refresh` (default 20 requests /
    15 min / IP). The limit is raised in the test environment.

## Catalog & vendors

17. **Brand name "Bazaar"** for the demo storefront.
18. **Vendor products are soft-deleted when they appear in past orders** (set
    `isActive=false`) so order history keeps its foreign keys and snapshots; products
    never ordered are hard-deleted along with their image files.
19. **Ownership checks return 404, not 403**, for another vendor's product, so vendors
    can't probe which product IDs exist.
20. **Product slugs get a short random suffix** (`handwoven-basket-3fa9c1`) because titles
    aren't unique across vendors; category and store slugs are plain and unique.
21. **Catalog search** uses case-insensitive `contains` over title, description,
    category name and store name. For large catalogs this should move to Postgres
    full-text search (`tsvector` + GIN index) — noted as a next step.
22. **Catalog filter state lives in the URL** (`?category=&sort=&page=`) so results are
    shareable and work with the back button.
23. **Image uploads** use multer memory storage → `StorageService.save()`. Only
    JPEG/PNG/WebP/GIF up to `MAX_UPLOAD_MB` (5 MB), max 8 per product. Local files are
    served from `/uploads` with a long cache. A Cloudinary/S3 adapter only needs to
    implement `save()` and `remove()`.
24. **Rejected vendors can re-apply**; the application flips back to `PENDING` and the
    rejection reason is cleared.
