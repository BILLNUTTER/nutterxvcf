# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── vcf-app/            # Nutterx VCF Verification System (React + Vite)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Nutterx VCF Verification System

A full-stack registration and admin verification platform for VCF (Virtual Contact File) distribution.

### Features
- **Two registration tracks**: Standard VCF and WhatsApp Bot VCF
- **Landing page**: Dark cyberpunk/neon design with progress bars showing verified member counts
- **Registration forms**: Name + phone with country flag picker (react-phone-number-input), success sound on submit
- **Admin dashboard**: Accessed via `?admin=true` URL param, protected by username/password login
- **Verified members list**: Public display of approved user names
- **Post-approval redirect**: Approved users get redirected to WhatsApp group links

### Environment Variables (all required in production)
- `ADMIN_USERNAME` — Admin dashboard username (set in `.replit` shared env; default: nutterx_admin)
- `ADMIN_PASSWORD` — Admin dashboard password (**Replit Secret**)
- `STANDARD_GROUP_LINK` — WhatsApp group link for approved Standard VCF users (set in `.replit` shared env)
- `BOT_GROUP_LINK` — WhatsApp group link for approved Bot VCF users (set in `.replit` shared env)
- `SUPABASE_DATABASE_URL` — Supabase PostgreSQL connection string (**Replit Secret**; falls back to local `DATABASE_URL`)
- `ADMIN_TOKEN_SECRET` — (optional) HMAC secret for admin session tokens; generated at runtime if absent (tokens are invalidated on server restart if not set)

### API Routes (all at `/api`)
- `POST /api/register` — Submit registration (name, phone [E.164], countryCode, registrationType); returns `claimToken` per registration
- `GET /api/users/verified` — Public list of approved user names by type (no phone/claim data exposed)
- `POST /api/redirect` — Returns WhatsApp group link if the provided `claimToken` belongs to an approved registration
- `POST /api/admin/login` — Admin login, returns session token (8-hour TTL, in-memory with expiry)
- `GET /api/admin/registrations` — All registrations (requires `x-admin-token` header)
- `PATCH /api/admin/registrations/:id` — Approve/reject a registration (requires `x-admin-token` header)

### Admin Actions
- **Approve** pending registrations → user can then get the WhatsApp group redirect link
- **Reject** pending registrations → user is blocked
- **Suspend** approved users → user stays visible in the public VCF directory (with "SUSPENDED" badge), cannot get redirect link, and cannot re-register with the same phone number
- **Restore** suspended users back to approved status
- **Delete** permanently removes a registration; the phone number can be used to register again

### Security Model
- Group links are **never** publicly exposed; only returned by `/api/redirect` after server-side approval check
- Each registration receives a unique cryptographic `claimToken` (64 hex chars); only the original registrant can retrieve the redirect link
- Phone numbers validated to E.164 format on both client (react-phone-number-input) and server
- Admin tokens expire after 8 hours; expired tokens are pruned on each login
- Suspended phones receive a distinct 403 error on registration attempts

### Database Schema
- **registrations** table: id, name, phone, country_code, status (pending/approved/rejected/suspended), registration_type (standard/bot), claim_token (unique, 64 hex chars), created_at

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for validation and `@workspace/db` for persistence.

### `artifacts/vcf-app` (`@workspace/vcf-app`)

React + Vite frontend. Dark cyberpunk neon theme. Uses `@workspace/api-client-react` for type-safe API calls.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Schema: `registrations` table.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
