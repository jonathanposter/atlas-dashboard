# Atlas Mission Control — Claude Code Guide

## Architecture
- **Framework:** Next.js 14 App Router with TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT in HTTP-only cookie (single user)
- **AI:** Anthropic Claude API (streaming)
- **Hosting:** Coolify on DigitalOcean (178.128.43.238)
- **Docker:** Multi-stage build with node:20-slim
- **basePath:** /dashboard (all routes under /dashboard/*)

## Project Structure
```
src/
  app/
    login/           - Login page (unauthenticated)
    (dashboard)/     - All authenticated pages
      page.tsx       - Mission Control overview
      chat/          - Atlas AI chat (streaming)
      tasks/         - Task queue & approvals
      pipeline/      - Pipeline visualization
      strategies/    - Strategy detail pages
      research/      - Hypothesis library
      log/           - Activity log
      settings/      - API keys, config
    api/             - All API routes
  lib/               - Shared utilities (db, auth, encrypt, etc.)
  middleware.ts      - Auth middleware
prisma/
  schema.prisma      - 8 models
  seed.ts            - Default user + initial state
```

## Deployment

### Coolify Details
- **Dashboard:** http://178.128.43.238:8000
- **App UUID:** `<TBD - set after creating app in Coolify>`
- **API token:** `<TBD - set after creating token>`
- **Live URL:** http://178.128.43.238/dashboard

### Environment Variables (set in Coolify)
```
DATABASE_URL=postgresql://postgres:<password>@10.0.1.7:5432/atlas
AUTH_SECRET=<64-char-random-string>
NODE_ENV=production
```

### Deploy Command
```bash
curl -s -H "Authorization: Bearer <API-TOKEN>" \
  "http://178.128.43.238:8000/api/v1/deploy?uuid=<APP-UUID>&force=true"
```

### CRITICAL: Deploy vs Restart
- **deploy** — pulls latest code, rebuilds Docker image, deploys new container (USE THIS)
- **restart** — just restarts existing container WITHOUT new code (WRONG for code changes)

## Development

### Local Dev
```bash
npm run dev
```
Requires local PostgreSQL with DATABASE_URL in .env

### Prisma
```bash
npx prisma db push     # Sync schema
npx prisma generate    # Regenerate client
npx prisma db seed     # Seed default data
```

### Git Push Pattern
```bash
git stash && git pull --rebase && git stash pop && git push
```

## Default Credentials
- Password: `atlas2026` (change immediately after first login)

## Key Design Decisions
- Single-user auth (not multi-tenant) — JWT in HTTP-only cookie
- API keys encrypted with AES-256-GCM using AUTH_SECRET
- Chat uses Anthropic streaming SSE for real-time responses
- Cross-validation sends proposals to OpenAI GPT-4 for independent review
- All data persists in PostgreSQL via Prisma
