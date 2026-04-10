---
name: database-migration-safety
description: "Use this for Prisma schema changes, migration creation, drift handling, and SQLite lock issues in this repo. Enforces safe migration flow, protects prisma/dev.db, applies FTS-aware manual migration path from MIGRATION_INSTRUCTIONS.md, and blocks destructive reset unless explicitly approved. Trigger words: migration, prisma migrate, drift detected, P3006, database is locked, schema change, FTS."
---

# Database Migration Safety (PediAssist)

This skill provides a safety-first workflow for DB schema changes and migrations in this repository.

## Mandatory Inputs

Before any migration action:
1. Read `tasks/TASKS.md` and active task file.
2. Read `tasks/AGENT.md` and follow its orchestration order strictly.
3. Read `MIGRATION_INSTRUCTIONS.md` completely.
4. Read `AI_CODING_GUIDELINES.md` and `DEVELOPMENT_RULES.md`.
5. Confirm the critical rule: never delete, overwrite, or allow git history operations to modify `prisma/dev.db`.

Treat `tasks/TASKS.md` + `tasks/AGENT.md` as mandatory orchestrator inputs. Do not execute migration actions if this pair is not synchronized.

## Core Rule

Data safety has priority over migration convenience.

- Never run destructive reset flows by default.
- Never suggest `migrate reset` when `Drift detected` appears, unless user explicitly approves data loss in dev context.
- Preserve `prisma/dev.db` and create backups before risky operations.

## Repo-Specific Migration Experience (Required)

Apply these learned constraints from `MIGRATION_INSTRUCTIONS.md`:

1. FTS drift behavior
- Presence of `guideline_chunks_fts` can cause `prisma migrate dev` drift failures.
- In this case prefer manual migration flow and `migrate resolve --applied`.

2. FTS drop safety
- Use `DROP TABLE IF EXISTS` for FTS virtual table cleanup.
- Do not manually drop FTS shadow tables (`_config`, `_data`, `_idx`, `_docsize`, `_content`) after dropping the virtual table.

3. Manual migration path (when drift blocks migrate dev)
- Create migration folder and `migration.sql` manually.
- Apply SQL directly to `prisma/dev.db` via Python sqlite script.
- Register migration with `npx prisma migrate resolve --applied <migration_name>`.
- Run `npx prisma generate` and verify `npx prisma migrate status`.

4. SQLite lock handling
- Stop Electron/Node processes before migration when DB is locked.
- Retry with clean connection state.

## Decision Tree

1. Standard path
- If no drift and no lock: use normal Prisma migration flow.

2. Drift path
- If `Drift detected` due to FTS objects: use manual migration path, no reset.

3. Lock path
- If `database is locked`: stop running app processes, retry migration/check commands.

4. Emergency path
- Only with explicit user approval: destructive recovery steps.
- Must document backup and reason before action.

## Pre-Flight Checklist

- [ ] Backup plan for `prisma/dev.db` exists.
- [ ] Current migration status captured (`npx prisma migrate status`).
- [ ] Risk type identified: normal, drift, lock, or emergency.
- [ ] Migration SQL reviewed for transaction safety and idempotency where relevant.
- [ ] FTS rules applied if migration touches guideline chunks or FTS objects.

## Post-Apply Checklist

- [ ] `npx prisma migrate status` is healthy.
- [ ] `npx prisma generate` completed.
- [ ] Critical tables and indexes validated.
- [ ] App boot smoke-check completed.
- [ ] Task log updated with commands run and outcome.

## Output Contract

Always report:
1. Path chosen: standard/manual/lock/emergency.
2. Commands executed.
3. Risk controls applied (backup, non-destructive handling).
4. Verification results.
5. Final gate: `SAFE_TO_PROCEED` or `BLOCKED_BY_MIGRATION_RISK`.

Provide this gate result to `release-readiness-gate` when migration is in scope.

## Guardrails

- Do not modify old migration files unless required and understood.
- If migration file is edited after apply, ensure checksum implications are handled according to repo instructions.
- Do not perform git cleanup operations that can impact `prisma/dev.db`.
- If uncertain, stop and ask user before any potentially destructive step.

## Fast Prompts

- "Prepare safe migration plan for this schema change"
- "Handle Prisma drift without data loss"
- "Fix P3006 / database is locked safely"
- "Apply migration using repo manual path"
