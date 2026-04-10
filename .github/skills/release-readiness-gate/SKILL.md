---
name: release-readiness-gate
description: "Use this before merge/release to perform a final quality gate: task completion status, compliance findings, test evidence, migration safety, docs updates, and explicit GO/NO-GO decision. Trigger words: release, readiness, quality gate, pre-release, can we ship, финальная проверка, merge gate."
---

# Release Readiness Gate (PediAssist)

This skill performs a final ship decision based on evidence.

## Goal

Produce a strict GO/NO-GO release decision with concrete blockers and required actions.

## Required Inputs

1. Read `tasks/TASKS.md` and identify active or target task.
2. Read `tasks/AGENT.md` and follow its orchestration order strictly.
3. Active or target task file and expected outcomes.
4. Outputs from related skills when available:
- `feature-compliance-audit`
- `post-implementation-testing`
- `database-migration-safety` (if DB touched)
- `ipc-contract-governance` (if IPC touched)
5. Relevant changed files and test results.
6. Updated docs and module README changelog.

Treat `tasks/TASKS.md` + `tasks/AGENT.md` as mandatory orchestrator inputs. Do not issue final GO/NO-GO without this synchronization.

If required evidence is missing for touched areas, run missing prerequisite skills before decision:
- migration touched -> `database-migration-safety`
- IPC touched -> `ipc-contract-governance`
- implemented feature scope -> `feature-compliance-audit`
- testing required/approved -> `post-implementation-testing`

## Gate Dimensions

1. Task completion
- Planned stages are complete or explicitly deferred with approval.

2. Compliance
- No unresolved Critical/High violations.
- Medium/Low findings have tracked follow-up or accepted risk.

3. Testing
- New functionality: required tests passed.
- Non-feature changes: test decision recorded (run or approved skip).
- If testing outcome is `SKIPPED_BY_USER_APPROVAL` for non-feature scope, treat testing dimension as PASS (documented waiver), not FAIL.

4. Migration safety (if applicable)
- Migration path is non-destructive and verified.
- `prisma/dev.db` integrity preserved.

5. IPC/API safety (if applicable)
- Contracts consistent across handler, preload, types, service, callers.

6. Documentation and traceability
- Task artifacts updated.
- Module README changelog updated.
- Notable risks and rollback notes captured.

## Decision Rules

Return `GO` only if:
- No open Critical/High blockers.
- Required tests are passed, or testing is formally waived by user approval for non-feature scope.
- Required docs/status artifacts are updated.

Otherwise return `NO_GO` with blocker list.

Missing mandatory evidence is a blocker and must result in `NO_GO`.

## Output Contract

Report in this order:
1. Release scope summary.
2. Gate matrix by dimension (PASS/FAIL/WAIVED).
3. Blockers (if any) with owner and fix action.
4. Residual risks.
5. Final decision: `GO` or `NO_GO`.

## Guardrails

- Do not downgrade unresolved Critical issues.
- Do not issue `GO` when mandatory evidence is missing.
- If evidence is unavailable, mark dimension `FAIL` or `WAIVED` with explicit reason.

## Fast Prompts

- "Run release readiness gate for TASK-001"
- "Can we ship this feature today?"
- "Give GO/NO-GO with blockers"
