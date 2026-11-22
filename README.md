# FinGBO

Caisse, receipts and payments for GBOne.

## Layout

| Folder | What it is |
|---|---|
| `apps/api` | Hono + tRPC API, Drizzle schema and migrations (PostgreSQL). Runs on `127.0.0.1:3001`. |
| `apps/web` | React + TanStack Router + TanStack Query (Vite). Runs on `localhost:3000`. |
| `packages/shared` | Code used by both apps: `money` (amounts in centimes), `auth` (roles, login input schema),
`users` (user and password forms, used by the admin panel). |

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
components/            app-level pieces: FormField, DatePicker, TimeInput, EntityCombobox (search + create), ConfirmDialog,
                       SortableHeader + useSort (click a column name to sort a table)
features/<feature>/    components and hooks for one feature
  auth/                login form, logout, session check, device hints
  files/               attachments editor, thumbnails, paperclip badge (movements and receipts)
  movements/           caisse day view, entry form
  receipts/            month view, receipt form
  people/              balances, person form, statement, "carried" list
  users/               admin panel: user form, password reset, sessions dialog
routes/
  login.tsx                 login page (?redirect= brings you back after logging in)
  _app.tsx                  layout for logged-in pages: checks auth.me, header, navigation, logout
  _app/index.tsx            the caisse (main page): ?date=YYYY-MM-DD, today by default
  _app/receipts.tsx         receipts of a month: ?month=YYYY-MM
  _app/debts.tsx            what you still owe, per person, with the receipts not yet paid
  _app/people/index.tsx     everyone with what you owe them
  _app/people/$personId.tsx a person's account (statement), what they carried, new receipt / pay
  _app/admin/users.tsx      users and their sessions (admins only; viewers are sent to /)
```

A person's balance (what you owe them) = their receipts − the money paid out to them.
Money received from them is shown on their page but never counts as a debt.

The debts page (`people.debts`) lists everyone with a balance above 0. Payments settle the oldest
receipts first, so the receipts still open are the newest ones (the oldest of them may be partly paid).

A movement has a day and a time of day (`time`, local time). The form proposes the current time and
it can be changed (typed on 24 hours: `1430` or `14:30`); the day's journal follows that time, and in
a person's account each day lists the receipts first, then the movements in the order of their time.

The interface is in French. Amounts travel as centimes and are converted only for display
(`formatAmount`) and input (`parseDA`).

### Login

- `auth.login({ username, password, device? })` returns `{ token, user }`. The web app keeps the
  token in localStorage and sends `Authorization: Bearer <token>`.
- The token never expires. Every request checks its session row, so a session is cut off as soon
  as it is revoked or the user is disabled.
- `auth.me` returns the current user; `auth.logout` revokes the current session.
- 5 failed logins for one username from one IP (or 20 from one IP) block for 15 minutes.

### Users and sessions (admin panel)

`modules/users` (all procedures are admin-only) and the page `/admin/users`:

- `users.list`: role, status, who created them, last activity and open sessions.
- `users.create`, `users.update` (full name, role), `users.setDisabled`, `users.resetPassword`.
- `users.sessions` (marks the `current` one), `users.revokeSession`, `users.revokeAllSessions`.
- Disabling a user or resetting their password revokes their open sessions (an admin resetting
  their own password keeps the session they are using). Revoking your own current session logs you out.
- An admin can't disable themself or remove their own admin role, and the last active admin can
  never be disabled or demoted (checked under a lock, so two admins can't demote each other at once).

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

## Docker (Dokploy)

Each app has its own Dockerfile. Both are built **from the repository root** (they need the whole
pnpm workspace), so in Dokploy set *Build Path* to `/` and *Dockerfile Path* as below.

| App | Dockerfile | Port | Settings |
| --- | --- | --- | --- |
| API | `apps/api/Dockerfile` | 3001 | Environment variables from `apps/api/.env.example` (`HOST`, `PORT`, `NODE_ENV` are already set in the image). Use `TRUST_PROXY=proxy` behind Dokploy's Traefik. `WEB_ORIGINS` = the web app's domain. |
| Web | `apps/web/Dockerfile` | 80 | `VITE_API_URL` = the API's public URL, under *Build-time Arguments* (not Environment): it is baked in at build time, so changing it needs a rebuild. Served by `pnpm start` (`serve -s dist`). |

- The API image has every dependency installed (dev ones included). Migrations are not run on
  start: run them by hand from a terminal in the API container (it opens in `/repo/apps/api`):
  `pnpm db:migrate`, and for the first admin `pnpm user:create --username <name>`.

## Docker on this Windows PC (docker compose)

`docker-compose.yml` runs the API (port 3001) and the web app (port 3000). PostgreSQL (Windows
service) and RustFS (its own container) stay outside; the API reaches them through
`host.docker.internal`.

1. Copy `apps/api/.env.docker.example` to `apps/api/.env.docker` and fill it in.
2. To open the app from other PCs, put `VITE_API_URL=http://<this PC's IP>:3001` in a `.env` next to
   `docker-compose.yml`, and add `http://<this PC's IP>:3000` to `WEB_ORIGINS`.

```
docker compose up -d --build              # build and start (again after each code change)
docker compose exec api pnpm db:migrate   # migrations, by hand
docker compose down                       # stop
```

Both containers restart by themselves (`restart: unless-stopped`) when Docker starts.

## Importing a year from the old CAISSE app

Two steps, both in `apps/api/src/scripts`:

```
powershell -ExecutionPolicy Bypass -File apps/api/src/scripts/export-old-caisse.ps1 -AppDir <old app folder> -OutDir <export folder>
pnpm --filter @fingbo/api import:caisse --dir <export folder> --year 2026 --username <admin>           # shows what it would do
pnpm --filter @fingbo/api import:caisse --dir <export folder> --year 2026 --username <admin> --apply   # writes it
```

- The export reads a copy of the old database (SQL Server Compact 3.5) and writes three JSON files.
- The import turns the year's old entries into movements (same day, same time, same person, the old
  expense type as category), reusing people and categories that already exist with the same name.
- The caisse balance left by the earlier years becomes one opening entry on 1 January.
- The old app had no receipts, so each person who was paid gets one initial receipt on 1 January
  (category `Reprise <year>`) equal to everything paid to them that year: their balance ends at 0.
- It runs in one transaction, checks that every imported person is at 0 and that the caisse matches
  the old app, and refuses to import the same year twice. Back up the database first (`pg_dump`).
