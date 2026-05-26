# DMM Draft Order

A Next.js + SQLite web app that lets viewers guess the DMM draft order. Users sign in with Kick, drag-and-drop 24 picks across 6 captains, and save their guess behind a private edit URL tied to their Kick account. An admin can lock in the official draft once it's revealed.

> Prize pool: whoever guesses the draft right gets **500M OSRS GP from Odablock**. If more than 3 people win, the first two entries in the winning draft face off in a Split or Steal.

## Features

- **Kick OAuth login** (`user:read` scope) with PKCE and state validation, persistent month-long signed session cookies, and refresh-token support so returning users stay signed in.
- **Image-only draft editor** (no free-text input) with drag/drop ordering and keyboard accessibility powered by `@dnd-kit`.
- **Snake-draft layout** of 24 picks under 6 captains, with a default chunked assignment that updates as picks are reordered.
- **Per-user single draft** — saving updates the same draft instead of creating duplicates. Each draft has a `publicId` plus a hashed `editKey`, exposed as `/d/{publicId}/{editKey}`.
- **Admin official-draft** endpoint to publish the canonical draft for comparison once revealed (`ADMIN_KICK_USERNAMES`).
- **Encrypted token storage** in SQLite with versioned keys, so access/refresh tokens are never stored in plaintext and never logged.
- **Rate limiting** of `/api/drafts` per session via lightweight in-memory limiter / proxy middleware.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript (strict, no `any`)
- [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) for an embedded, file-based database
- [`@dnd-kit`](https://dndkit.com/) for drag-and-drop ordering
- [`zod`](https://zod.dev/) for environment and request validation
- [`vitest`](https://vitest.dev/) for unit tests
- Kick OAuth (`https://id.kick.com/oauth/authorize` + `https://id.kick.com/oauth/token`)

## Project layout

```
src/
  app/
    page.tsx                       # Landing + carousel of all submitted drafts
    layout.tsx, globals.css        # Root layout & styles
    auth/kick/{start,callback}/    # OAuth start (PKCE + state) and callback
    draft/new/page.tsx             # Create / edit current user's draft
    d/[publicId]/page.tsx          # Public read-only view of a draft
    d/[publicId]/[editKey]/page.tsx# Owner-only editable view
    api/drafts/                    # Create / update / fetch draft endpoints
    api/admin/official-draft/      # Admin-only: publish the official draft
    api/images/[file]/             # Serves participant images from /images
    admin/page.tsx                 # Admin UI to set the official draft
    privacy/page.tsx               # Privacy disclosure page
  components/                      # Editor, viewer, carousel, snake board UIs
  data/participants.ts             # 6 captains + 24 picks manifest
  lib/                             # auth, session, kick client, crypto,
                                   # rate-limit, env validation, snake-draft
  server/db/                       # schema.sql + typed queries (better-sqlite3)
  proxy.ts                         # Per-session rate limit on /api/drafts
images/                            # Participant PNGs
tests/                             # Auth callback + draft authorization tests
```

## Getting started

### Prerequisites

- Node.js 20+ (required for Next.js 16)
- A Kick developer application configured for OAuth — see the [Kick docs](https://docs.kick.com) for client setup. Set the redirect URI to match `KICK_REDIRECT_URI` (e.g. `http://localhost:15000/auth/kick/callback` for local dev).

### Install

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
| --- | --- |
| `SESSION_SECRET` | 32+ char secret used to sign session cookies. |
| `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET` | Credentials from your Kick app. |
| `KICK_REDIRECT_URI` | Must match the redirect URI registered with Kick. |
| `TOKEN_ENCRYPTION_KEY_V1` | 32-byte key (hex or base64) used to encrypt stored OAuth tokens. |
| `TOKEN_ENCRYPTION_KEY_VERSION` | Active key version (default `1`). Add `TOKEN_ENCRYPTION_KEY_V2`, etc. to rotate. |

Optional:

| Variable | Default | Description |
| --- | --- | --- |
| `SQLITE_PATH` | `./data/app.db` | SQLite file location (must be writable). |
| `KICK_SCOPE` | `user:read` | OAuth scope requested. |
| `KICK_API_BASE_URL` | `https://api.kick.com/public/v1` | Kick public API base. |
| `SESSION_COOKIE_DOMAIN` | _(unset)_ | Cookie domain for production. |
| `DRAFT_RATE_LIMIT_PER_MINUTE_USER` | `60` | Per-session limit for `/api/drafts`. |
| `ADMIN_KICK_USERNAMES` | _(empty)_ | Comma-separated Kick usernames allowed to publish the official draft. |

Generate a strong session secret and token key:

```bash
openssl rand -base64 32   # SESSION_SECRET
openssl rand -hex 32      # TOKEN_ENCRYPTION_KEY_V1
```

### Run in development

```bash
npm run dev
```

The app starts on [http://localhost:15000](http://localhost:15000). The SQLite database and schema (`src/server/db/schema.sql`) are created automatically on first request.

### Build & start production

```bash
npm run build
npm run start
```

Run behind an HTTPS-terminating reverse proxy in production so the secure session cookie works correctly. Make sure the directory for `SQLITE_PATH` is writable by the Node process.

### Other scripts

```bash
npm run lint        # ESLint (next/core-web-vitals)
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run test:watch  # vitest in watch mode
```

## Data model

`src/server/db/schema.sql` defines four tables:

- `users` — `kick_username` plus encrypted `access_token`/`refresh_token`/`token_type`/`expires_in`/`scope` and `token_key_version` for rotation.
- `sessions` — opaque session id, owning `user_id`, expiry (≥ 30 days), and a hashed user-agent fingerprint.
- `drafts` — one per user, with `public_id`, `edit_key_hash`, `picks_order_json`, and optional `captain_assignments_json`.
- `official_draft` — single-row table holding the canonical revealed draft, set by an admin user.

Drafts are addressable as:

- `/d/{publicId}` — read-only public view.
- `/d/{publicId}/{editKey}` — editable view; requires the owner to be signed in **and** the `editKey` to match the stored hash.

## Authentication & privacy

- The OAuth flow uses PKCE + a signed `state` cookie and exchanges the code at `https://id.kick.com/oauth/token`.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production with a 30+ day max age.
- OAuth tokens are encrypted at rest with AES-256 using the active `TOKEN_ENCRYPTION_KEY_V*` and never written to logs.
- Only Kick username and the encrypted token fields needed for session continuity are persisted. The `/privacy` page exposes this to users.

## Updating participants / images

1. Drop new PNGs into `images/`.
2. Update `src/data/participants.ts` — each entry has a stable `id` (independent of filename) plus `label` and `fileName`. There must be exactly 6 captains and 24 picks for the editor to work.

## Tests

Vitest covers:

- `tests/auth-callback.test.ts` — Kick OAuth callback validation.
- `tests/draft-authorization.test.ts` — owner + edit-key authorization for draft updates.

Run `npm run test` to execute them.

## License

MIT
