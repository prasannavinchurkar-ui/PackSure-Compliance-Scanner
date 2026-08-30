---
name: API contract numeric compatibility
description: OpenAPI integer schemas can generate an unsupported validator call in this workspace.
---

Use OpenAPI `number` for numeric API fields when the generated Zod package is the older Zod 3-compatible build; reserve integer semantics for server-side storage and validation.

**Why:** The current generator emitted `zod.int()` for OpenAPI `integer`, but the installed validator package does not expose that API, causing library typecheck failures after otherwise successful code generation.

**How to apply:** If a new contract needs count, ID, score, or pagination fields, keep the generated boundary numeric and enforce integer constraints in server logic or database types when required.