---
description: "Use when working on tasks in PediAssist: task-first execution via tasks/TASKS.md, mandatory task file sync, MCP server routing (context7/filesystem/dev-db/vidal-db/mem0), conditional post-implementation testing, and final release gate decision. Trigger words: TASKS.md, task workflow, MCP, dev-db, vidal-db, mem0, testing decision, release gate."
name: "PediAssist Task Workflow"
---

# PediAssist Task Workflow

Follow this workflow for implementation and review requests in this repository.

## Task-First Rule

- Always read `tasks/TASKS.md` first.
- Identify active task (`IN_PROGRESS` or `PLANNED`).
- Open the corresponding `tasks/DD.MM.YYYY/TASK-NNN.md` file before any code edits.
- Do not implement changes outside the active task scope unless user explicitly requests it.

## MCP Routing Rule

Use MCP servers by data source and goal:

- `context7`: up-to-date docs and practices.
- `filesystem`: file tree and file-content synchronization before edits.
- `dev-db`: SQL checks for project database `prisma/dev.db`.
- `vidal-db`: SQL checks for `C:/Users/Arty/Desktop/ru.medsolutions/vidal.db`.
- `mem0-mcp`: long-term memory retrieval and storage for reusable decisions, conventions, and resolved blockers.
- `memory`: store and reuse repo lessons that affect recurring tasks.

Use `mem0-mcp` for cross-session/team memory, and `memory` for local repo/session notes.

## Skill Handoff Rule

When relevant, invoke specialized workflow skills:

- `database-migration-safety` for Prisma schema/migration/drift/lock scenarios.
- `ipc-contract-governance` for IPC/preload/electronAPI contract changes.
- `feature-compliance-audit` before closing implemented feature scope.
- `post-implementation-testing` after implementation when testing is required.
- `release-readiness-gate` before final close/ship decision.

## Testing Decision Rule

- If new functionality is added: testing is mandatory.
- If change is non-feature (refactor/docs/config/styling-only): ask user whether to run tests.
- If user declines tests for non-feature scope: record approved skip and mark as documented waiver.

## Closure Rule

- Do not mark task fully done without required handoffs.
- Final ship/close decision must pass release gate evidence (`GO` vs `NO_GO`).
- Missing mandatory evidence is a blocker.
