# PackSure Compliance Scanner

PackSure helps Indian Legal Metrology inspectors scan packaged commodity labels, review extracted declarations and rule-linked findings, and keep a searchable inspection history.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/packsure/src/App.tsx` — responsive dashboard, scan intake, history, report detail, and settings UI
- `artifacts/packsure/src/index.css` — PackSure theme tokens and visual system
- `lib/api-spec/openapi.yaml` — source of truth for dashboard, activity, scan, and report contracts
- `artifacts/api-server/src/routes/scans.ts` — scan analysis, seed history, dashboard aggregates, and activity routes
- `lib/db/src/schema/scans.ts` — PostgreSQL scan repository model

## Architecture decisions

- API contracts are defined in OpenAPI first and generated into the shared React client and Zod validators.
- The first build uses a deterministic rule-analysis adapter so the hackathon demo is reliable without claiming production OCR accuracy.
- Source evidence metadata and structured declarations/findings are stored together per scan for traceable reports.
- The UI keeps the officer in control: analysis surfaces confidence and rule references, while findings remain explicit review items.

## Product

- Overview dashboard with compliance rate, decision split, scans today, open findings, compliance pulse, and recent activity.
- New scan workflow with package image intake, product metadata, deterministic analysis, and navigation to a report.
- Searchable/filterable inspection repository with status, risk, issue count, and inspection date.
- Detailed report view with image evidence treatment, declaration confidence, rule references, findings, and text export.
- Settings surface for inspector preferences, alerts, language, active rule-set, and data handling context.

## User preferences

No persistent preferences provided.

## Gotchas

- The generated validator package in this workspace is Zod 3-compatible; OpenAPI numeric fields should use `number` rather than `integer` to avoid generating unsupported `zod.int()` calls.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
