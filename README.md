# FinGBO

Caisse, receipts and payments for GBOne.

## Layout

| Folder | What it is |
|---|---|
| `apps/api` | Hono + tRPC API, Drizzle schema and migrations (PostgreSQL). Runs on `127.0.0.1:3001`. |
| `apps/web` | React + TanStack Router + TanStack Query (Vite). Runs on `localhost:3000`. |
| `packages/shared` | Code used by both apps: `money` (amounts in centimes), `auth` (roles, login input schema). |

### API (`apps/api/src`)

```
index.ts            starts the server
app.ts              Hono: logger, security headers, CORS, /health, /trpc
env.ts              environment variables, checked at startup
db/                 Drizzle client and schema (auth.ts, ledger.ts, files.ts)
trpc/               init (procedures), context (per request), router (AppRouter)
modules/<feature>/  <feature>.router.ts (inputs + permissions) and <feature>.service.ts (logic + queries)
lib/                small helpers (client IP / user agent, Postgres error codes)
scripts/            command-line tools (create-user)
```

Procedures: `publicProcedure` (login, health), `authedProcedure` (any logged-in user),
`adminProcedure` (admins only).

### Web (`apps/web/src`)

```
main.tsx, router.tsx   router with { queryClient, trpc } in its context; "session ended" handler
lib/                   trpc client, auth token (localStorage), errors, dates, money, cn() (utils.ts)
components/ui/         shadcn/ui components (add more with: npx shadcn@latest add <name>)
components/            app-level pieces: FormField, DatePicker, EntityCombobox (search + create)
features/<feature>/    components and hooks for one feature
  auth/                login form, logout, session check, device hints
  files/               attachments editor, thumbnails, paperclip badge (movements and receipts)
  movements/           caisse day view, entry form
  receipts/            month view, receipt form
  people/              balances, person form, statement, "carried" list
routes/
  login.tsx                 login page (?redirect= brings you back after logging in)
  _app.tsx                  layout for logged-in pages: checks auth.me, header, navigation, logout
  _app/index.tsx            the caisse (main page): ?date=YYYY-MM-DD, today by default
  _app/receipts.tsx         receipts of a month: ?month=YYYY-MM
  _app/people/index.tsx     everyone with what you owe them
  _app/people/$personId.tsx a person's account (statement), what they carried, new receipt / pay
```

A person's balance (what you owe them) = their receipts − the money paid out to them.
Money received from them is shown on their page but never counts as a debt.

The interface is in French. Amounts travel as centimes and are converted only for display
(`formatAmount`) and input (`parseDA`).

### Login

- `auth.login({ username, password, device? })` returns `{ token, user }`. The web app keeps the
  token in localStorage and sends `Authorization: Bearer <token>`.
- The token never expires. Every request checks its session row, so a session is cut off as soon
  as it is revoked or the user is disabled.
- `auth.me` returns the current user; `auth.logout` revokes the current session.
- 5 failed logins for one username from one IP (or 20 from one IP) block for 15 minutes.

## Setup

1. Copy `apps/api/.env.example` to `apps/api/.env` and fill in `DATABASE_URL`, `JWT_SECRET` and the
   `S3_*` settings (RustFS/MinIO bucket for attachments; the API checks it at startup).
2. Copy `apps/web/.env.example` to `apps/web/.env` (`VITE_API_URL`).

```
pnpm install
pnpm db:migrate
pnpm --filter @fingbo/api user:create --username <name>     # first admin
pnpm dev                                                    # API and web together
```

Other commands: `pnpm typecheck`, `pnpm build`, `pnpm db:generate` (after a schema change),
`pnpm db:studio`.

Production: `pnpm build`, then run `node --env-file=.env dist/index.mjs` in `apps/api`
and serve `apps/web/dist` as static files.
