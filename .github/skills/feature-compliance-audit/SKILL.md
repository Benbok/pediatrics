---
name: feature-compliance-audit
description: "Use this when user asks to review or audit an already implemented feature for compliance with project development rules. Performs rules-based checks, reports findings by severity with file references, identifies regressions and test gaps, and provides a remediation plan. Trigger words: review, audit, compliance, соответствие правилам, проверить готовый функционал, code review, регрессия, quality gate."
---

# Feature Compliance Audit (PediAssist)

This skill audits already implemented functionality against repository development rules.

## Goal

Find and report non-compliance, regressions, and quality risks in completed code.

Primary output is a findings report, not a rewrite.

## Required Inputs

Before audit starts:
1. Read `tasks/TASKS.md` and identify current relevant task.
2. Read task file `tasks/DD.MM.YYYY/TASK-NNN.md` for scope and expected behavior.
3. Read rules:
   - `AI_CODING_GUIDELINES.md`
   - `DEVELOPMENT_RULES.md` (if present)
   - `tasks/AGENT.md`
4. Identify changed files for the feature (from task file or git diff).

If task scope is unclear, ask user to confirm exact module/files before auditing.

## Audit Coverage

Always validate these categories.

1. Architecture layering
- Components keep UI concerns only.
- Business logic located in services.
- IPC/database logic stays in backend handlers.

2. Validation and security
- Double validation where applicable (frontend service and backend IPC).
- `ensureAuthenticated` used for IPC handlers.
- Backend does not trust raw frontend payloads.

3. Backend reliability
- `logger` used instead of `console` in electron/backend.
- Related DB mutations use transactions.
- JSON parsing done at data boundary only.
- CacheService usage considered for frequently read handlers.

4. React/state safety
- Derived lists use `useMemo` (not `useState + useEffect` loops).
- No unstable dependency patterns causing update loops.

5. Type and maintainability checks
- Functions are typed where project conventions require.
- No magic numbers when constants are expected.
- Large duplicated blocks extracted when practical.

6. Testing and regression checks
- Unit/integration tests cover new logic and edge cases.
- Assertions align with expected behavior from task file.
- Missing tests are reported as findings.

## Severity Model

Classify findings in this order:
- Critical: security/data loss/auth bypass/unsafe trust boundary.
- High: architectural violations likely to cause regressions.
- Medium: maintainability/performance risks.
- Low: style/minor consistency issues.

## Output Contract (Mandatory)

Return findings first, ordered by severity.

For each finding use this format:
- Severity: <Critical|High|Medium|Low>
- Rule: <violated rule>
- Evidence: <file path + line or concrete behavior>
- Risk: <what can break>
- Fix: <minimal corrective action>

After findings include:
1. Open questions/assumptions.
2. Brief change-summary (only if needed).
3. Residual risks and testing gaps.

If no findings exist, explicitly state that no violations were found and list residual risks/test gaps if any.

## Execution Steps

1. Context sync
- Refresh context with project files and latest task state.

2. Scope lock
- Build exact list of files and interfaces to audit.

3. Rule-by-rule verification
- Check each audit category against concrete code.

4. Test evidence check
- Verify available tests and whether they cover introduced behavior.

5. Produce compliance report
- Emit findings in mandatory output contract format.

6. Optional remediation stage
- If user asks, implement fixes in priority order and re-run relevant tests.

## Skill Integrations

- If findings involve migration/Prisma safety risks, trigger `database-migration-safety`.
- If findings involve IPC contract mismatch, trigger `ipc-contract-governance`.
- For unresolved findings before ship decision, pass results into `release-readiness-gate`.

## Guardrails

- Do not rewrite broad code without user request.
- Do not hide missing evidence: mark uncertain items as assumptions.
- Do not report generic issues without concrete evidence.
- Keep recommendations minimal, targeted, and consistent with repository patterns.

## Fast Prompts

Use this skill for commands like:
- "Проверь готовый функционал на соответствие правилам разработки"
- "Сделай compliance audit для TASK-001"
- "Code review на регрессии и нарушение AI_CODING_GUIDELINES"
