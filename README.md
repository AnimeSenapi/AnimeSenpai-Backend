### AnimeSenpai Backend

Type-safe tRPC API powered by Bun, TypeScript, and Prisma.

---

### Quick start

```bash
# From repo root
cd AnimeSenpai-Backend
bun install
cp env.example .env

# Start the dev server (Bun)
bun dev
# → http://localhost:3005
```

---

### Requirements

- Bun 1.0+
- Node.js not required (use Bun)
- SQLite (dev) or PostgreSQL (prod)

---

### Environment

Create `.env` from `env.example` and set:

- DATABASE_URL (dev defaults to `file:./prisma/dev.db`)
- JWT_SECRET, JWT_REFRESH_SECRET
- EMAIL_FROM and SMTP settings (if emailing)
- FRONTEND_URL (CORS)

Tip: keep secrets out of git; use your deployment’s secret manager.

---

### Run scripts

Safe, commonly used scripts:

```bash
# Health and status
bun scripts/check-db-status.ts

# Generate recommendation embeddings
bun scripts/generate-embeddings.ts

# Create local test accounts (dev only)
bun scripts/create-test-accounts.ts
```

Note: More utilities exist in `scripts/`. Avoid destructive scripts unless you know what they do.

---

### Database (Prisma + SQLite dev)

- Dev DB file: `prisma/dev.db`
- Do not run destructive operations or schema changes without approval.
- Read these before any DB work:
  - `NO_MIGRATIONS.md`
  - `PRISMA_SETUP.md`

Studio (read/manage data locally):

```bash
bunx prisma studio
```

---

### Development

- Dev server: `bun dev` → port 3005
- Build: `bun run build`
- Start (prod build): `bun run start`

API entrypoint: `api/index.ts`  
App entrypoint: `src/index.ts`

---

### Observability

- Logging: see `docs/LOGGING.md`
- Sentry (server): import `@sentry/node` and capture errors

Example:

```ts
import * as Sentry from '@sentry/node'

try {
  // code
} catch (error) {
  Sentry.captureException(error)
  throw error
}
```

---

### Docker

- `docker-compose.yml` provided at repo root
- Backend container exposes port 3005 by default

Start (example):

```bash
docker compose up --build
```

---

### Project structure

- `api/` Nextless serverless-style handler glue
- `src/` core app code
  - `routers/` tRPC routers
  - `lib/` services, utils, data-access
  - `tests/` test suites
- `prisma/` schema and local SQLite DB
- `scripts/` operational scripts

---

### Important notes

- Use Bun for all commands (not npm/pnpm/yarn).
- Backend runs on port 3005; frontend runs on 3000.
- Be careful with any script that mutates data. When in doubt, ask first.

---

### Useful links

- `QUICK_START.md`
- `PRISMA_SETUP.md`
- `NO_MIGRATIONS.md`
- `OPTIMIZE_TROUBLESHOOTING.md`
- Frontend: `../AnimeSenpai-Frontend`
