---
name: task-lifecycle-orchestrator
description: "Use this when user asks to create/start/plan/execute/close a TASK in this repo: create TASK entry and file, validate against development rules, produce sequential implementation stages, show stages for user confirmation, then implement and close task. Trigger words: task, TASKS.md, plan, etap, etapy, этап, этапы, закрыть задачу, close task, IN_PROGRESS, DONE."
---

# Task Lifecycle Orchestrator (PediAssist)

This skill standardizes the full lifecycle of a repository task from creation to closure.

## Scope

Use this skill for requests like:
- Create a new task in task tracker.
- Prepare a detailed implementation plan in a dedicated task file.
- Validate plan against repository development rules.
- Execute stages only after explicit user confirmation.
- Close task and update trackers/docs.

Do not use this skill for one-line code edits unrelated to task lifecycle.

## Mandatory Inputs

Before any code edit:
1. Read `tasks/TASKS.md`.
2. Read `tasks/AGENT.md` and follow its orchestration order strictly.
3. Identify active task (`IN_PROGRESS` or `PLANNED`).
4. If no active task exists and user asks to start a new task: create one.
5. Read task details file `tasks/DD.MM.YYYY/TASK-NNN.md`.
6. Read rule files:
   - `AI_CODING_GUIDELINES.md`
   - `DEVELOPMENT_RULES.md` (if present)
   - `tasks/AGENT.md`

`tasks/TASKS.md` + `tasks/AGENT.md` form a mandatory orchestrator pair. Any implementation without this pair is non-compliant.

## Skill Handoff Rules

Use specialized skills as mandatory handoffs when matching conditions are detected:

1. Database/schema/migration conditions
- If task changes `prisma/schema.prisma`, `prisma/migrations/`, or includes Prisma migration commands/errors (`Drift detected`, `P3006`, `database is locked`), invoke `database-migration-safety` first.

2. IPC contract conditions
- If task changes IPC handlers, preload exposure, electronAPI typing, or service-to-IPC contracts, invoke `ipc-contract-governance`.

3. Post-implementation testing conditions
- If task introduces new functionality, invoke `post-implementation-testing` before closure.
- If task is non-feature change, apply testing decision rule and record user decision.

4. Compliance audit conditions
- Before final closure, run `feature-compliance-audit` on implemented scope.

5. Release decision conditions
- Before marking task fully done, run `release-readiness-gate` and use its `GO/NO_GO` as the final ship signal.

Do not bypass these handoffs when conditions match.

## New Task Creation Workflow

Follow strictly in this order.

1. Determine next task id:
- Scan `tasks/` for max `TASK-NNN` and increment by 1.

2. Update task tracker:
- Add row to active tasks table in `tasks/TASKS.md` with status `IN_PROGRESS`.

3. Create date folder:
- Create `tasks/DD.MM.YYYY/` if missing.

4. Create dedicated task plan file:
- Base on `tasks/_templates/TASK-TEMPLATE.md`.
- Save as `tasks/DD.MM.YYYY/TASK-NNN.md`.
- Fill all sections: context, expected outcome, impacted files, checklist, plan stages, execution log.

## Rule Compliance Gate

Before implementation starts, enforce a compliance check:

1. Validate plan against architecture order:
- Prisma schema/migration
- Zod validators
- IPC handlers
- Types
- Service layer
- Component/UI
- Tests

2. Validate critical rules:
- No business logic in components.
- Frontend and backend validation (double validation).
- `ensureAuthenticated` for IPC handlers.
- `logger` instead of `console` in backend/electron.
- Transactions for related DB operations.
- Derived lists through `useMemo`, not `useEffect + useState` loops.

3. Update task file checklist with current status.

If any rule is violated in the plan, rewrite plan before coding.

## Stage Plan Format (Must Show to User)

When plan is ready, present stage gates in this exact shape:

- Stage 1: <name>, files: <list>, result: <expected>
- Stage 2: <name>, files: <list>, result: <expected>
- Stage 3: <name>, files: <list>, result: <expected>
- Stage N: Tests and verification (mandatory for new functionality)

Then ask explicit confirmation:
- "Confirm execution of this plan?"

Do not implement stages until user confirms.

## Testing Decision Rule

Before closing a task, classify implementation type:

1. New functionality added
- Testing is mandatory.
- Run post-implementation testing (unit + basic frontend checks).

2. No new functionality (for example: refactor, docs, infra/config, cosmetic-only changes)
- Ask user explicitly whether to run tests.
- If user confirms: run tests.
- If user declines: record the user-approved skip in task log.

Never silently skip this decision.

## Execution Workflow (After Confirmation)

For each stage:
1. Mark stage status in task file: TODO -> IN_PROGRESS -> DONE.
2. Implement only files in stage scope.
3. Apply testing decision rule:
- New functionality: run relevant tests.
- No new functionality: ask user whether to run tests.
4. Append timestamped log entry in task file with what changed and test result.
5. Sync latest context before next stage.

## Completion Workflow

After all stages are done:

1. Fill final report in `tasks/DD.MM.YYYY/TASK-NNN.md`:
- completion date
- concise summary
- changed files list

2. Move task row in `tasks/TASKS.md`:
- from active to completed table
- set status to `DONE`

3. Update module README changelog:
- `src/modules/<module>/README.md` (create if absent)
- Add task entry with date, key changes, new handlers/services.

4. Provide final delivery report to user:
- what was implemented
- what was tested
- what task artifacts were updated

Do not close task as fully verified if testing was skipped without explicit user approval.
Do not close task as fully done without completing required handoffs and final release gate decision.

## Output Contract

When this skill is used, the assistant output order must be:
1. Active/new task detected.
2. Compliance check result.
3. Stage plan for confirmation.
4. Implementation progress by stage (after confirmation).
5. Closure report.

## Failure Handling

If blocked:
- set task status to `PAUSED`
- write blocker reason in task log
- ask user for decision

Never silently skip task tracker or task plan updates.
