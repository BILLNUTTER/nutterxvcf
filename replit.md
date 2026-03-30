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

### Environment Variables
- `ADMIN_USERNAME` — Admin dashboard username (default: nutterx_admin)
- `ADMIN_PASSWORD` — Admin dashboard password
- `STANDARD_GROUP_LINK` — WhatsApp group link for approved Standard VCF users
- `BOT_GROUP_LINK` — WhatsApp group link for approved Bot VCF users

### API Routes (all at `/api`)
- `POST /api/register` — Submit registration (name, phone, countryCode, registrationType)
- `GET /api/users/verified` — Public list of verified users by type
- `GET /api/config` — Returns group links (public)
- `POST /api/admin/login` — Admin login, returns session token
- `GET /api/admin/registrations` — All registrations (requires `x-admin-token` header)
- `PATCH /api/admin/registrations/:id` — Approve/reject a registration (requires `x-admin-token` header)

### Database Schema
- **registrations** table: id, name, phone, country_code, status (pending/approved/rejected), registration_type (standard/bot), created_at

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
