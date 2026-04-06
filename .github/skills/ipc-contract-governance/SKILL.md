---
name: ipc-contract-governance
description: "Use this when adding or changing Electron IPC handlers and renderer calls. Enforces contract-first IPC design, auth + validation on backend, type alignment in src/types.ts, compatibility checks, and regression-safe rollout. Trigger words: IPC, electronAPI, database.cjs, preload, handler, invoke, contract, schema."
---

# IPC Contract Governance (PediAssist)

This skill governs safe evolution of IPC interfaces between renderer and Electron backend.

## Goal

Prevent contract drift and security regressions when IPC methods are introduced or modified.

## Mandatory Inputs

1. Read active task scope in `tasks/TASKS.md` and task file.
2. Read `AI_CODING_GUIDELINES.md` and `DEVELOPMENT_RULES.md`.
3. Locate affected files across:
- `electron/database.cjs` (or module handlers)
- `electron/preload.cjs`
- `src/types.ts`
- `src/services/*.service.ts`
- UI caller modules in `src/modules/`

## Contract-First Rules

1. Define request/response contract first.
2. Validate input twice where applicable:
- frontend service validation for UX
- backend handler validation for security
3. Require `ensureAuthenticated` for protected handlers.
4. No direct component-to-IPC calls; go through service layer.
5. Keep parsing at data boundary; avoid duplicate JSON parsing downstream.

## Change Workflow

1. Contract draft
- Specify method name, payload fields, response shape, and errors.

2. Backend handler update
- Add `ensureAuthenticated`.
- Add Zod parse and structured error handling.
- Use logger, not console.

3. Preload exposure update
- Expose minimal required surface through `contextBridge`.
- Do not expose raw `ipcRenderer` patterns unnecessarily.

4. Types sync
- Update `src/types.ts` electron API interface and related types.

5. Service integration
- Add or update service method with frontend validation and typed return.

6. UI integration
- Keep components thin and call service only.

7. Compatibility check
- Validate that old callers are updated or backward compatibility is preserved.

## Breaking Change Gate

A change is breaking if method name, required payload fields, or response structure changes.

For breaking changes, do at least one:
- Introduce versioned method name.
- Add temporary compatibility adapter.
- Update all callers in same change-set.

## Audit Checklist

- [ ] Handler has `ensureAuthenticated`.
- [ ] Backend Zod validation exists.
- [ ] Frontend service validation exists.
- [ ] `src/types.ts` updated and consistent.
- [ ] No direct IPC from components.
- [ ] Errors are logged with `logger` on backend.
- [ ] Tests cover success + validation failure + auth failure path.

## Output Contract

Return:
1. Contract summary (before/after).
2. Compatibility status (`COMPATIBLE` or `BREAKING`).
3. Files updated and why.
4. Risk list and mitigation.
5. Final gate: `IPC_READY` or `BLOCKED_BY_IPC_RISK`.

Provide this gate result to `release-readiness-gate` when IPC surface is affected.

## Fast Prompts

- "Add new IPC handler with full contract governance"
- "Review this IPC change for compatibility and safety"
- "Synchronize electronAPI types with backend handler"
