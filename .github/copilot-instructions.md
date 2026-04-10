# Copilot Instructions for PediAssist

These rules are mandatory for all Copilot agent requests in this repository.

## 1) Mandatory task orchestrator

Before any implementation, edits, reviews, or test runs:
1. Read TASKS.md.
2. Read tasks/AGENT.md.
3. Identify active task with status IN_PROGRESS or PLANNED.
4. Open task file tasks/DD.MM.YYYY/TASK-NNN.md.
5. Continue only within active task scope unless user explicitly asks otherwise.

TASKS.md + tasks/AGENT.md are a mandatory orchestrator pair.

## 2) MCP tool routing (mandatory)

Use tools by source of truth:
- context7: up-to-date documentation and best practices.
- filesystem tools: project tree and file content synchronization before edits.
- dev-db MCP: all SQL checks for prisma/dev.db.
- vidal-db MCP: all SQL checks for C:/Users/Arty/Desktop/ru.medsolutions/vidal.db.
- mem0-mcp + memory: persist and reuse programming context, decisions, and blockers.

Never replace dev-db / vidal-db queries with ad-hoc Python scripts when MCP DB tools are available.

## 3) Implementation order

Follow repository order for feature work:
1. Prisma schema and migration.
2. Zod validators.
3. IPC handler backend.
4. Types sync.
5. Service layer.
6. UI components.
7. Tests.

## 4) Safety and architecture

- No direct IPC calls from components; use service layer.
- Use auth checks and backend validation for IPC handlers.
- Prefer logger over console in backend/electron.
- Do not run destructive DB or git operations unless user explicitly approves.
- Never delete, overwrite, or risk-modify prisma/dev.db.

## 5) Testing and closure

- New functionality: testing is mandatory.
- Non-feature changes: ask user whether tests should run.
- Do not mark task done without updating task artifacts and evidence.
- Before final close/ship decision, run release readiness gate logic.

## 6) Skill usage

When conditions match, use these skills:
- database-migration-safety
- ipc-contract-governance
- feature-compliance-audit
- post-implementation-testing
- release-readiness-gate
- task-lifecycle-orchestrator

## 7) Traceability requirements

After each stage:
- Update stage status in task file.
- Add a timestamped task log entry.
- Save key implementation decisions and blockers via mem0-mcp or memory.
