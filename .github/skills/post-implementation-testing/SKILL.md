---
name: post-implementation-testing
description: "Use this after implementing new functionality to run required unit tests and basic frontend tests, validate results, report failures with root-cause hints, and block task closure until tests pass or are explicitly accepted. Trigger words: unit test, frontend test, smoke test, after implementation, после реализации, прогон тестов, тесты после фичи, verify tests."
---

# Post-Implementation Testing (PediAssist)

This skill governs testing after implementation and enforces when testing is mandatory.

## Goal

Run unit and basic frontend tests when required, provide a clear pass/fail report, and prevent silent task completion without an explicit testing decision.

## Required Context

Before running tests:
1. Read `tasks/TASKS.md` and identify active task.
2. Read `tasks/AGENT.md` and follow its orchestration order strictly.
3. Read `tasks/DD.MM.YYYY/TASK-NNN.md` and extract changed scope.
4. Read `AI_CODING_GUIDELINES.md` testing rules.
5. Classify change type: new functionality or non-feature change.
6. Build test target list from changed files and impacted behavior.

Treat `tasks/TASKS.md` + `tasks/AGENT.md` as mandatory orchestrator inputs. Do not run closure-testing flow until both are synchronized.

If scope is unclear, ask user to confirm exact files/feature boundaries first.

## Testing Trigger Rule

1. New functionality added
- Testing is mandatory.
- Run unit tests and basic frontend smoke tests.

2. No new functionality (for example: refactor, docs, config, styling-only)
- Ask user explicitly whether to run tests.
- Run tests only after user confirmation.
- If user declines, mark as approved skip in report and task log.

## Test Policy

When testing is required or approved, run in this order:

1. Targeted unit tests
- Prefer focused tests for changed logic first.
- Example commands in this repo:
  - `npm run test -- tests/<target>.test.*`
  - `npm run test -- src/**/<target>.test.*`

2. Basic frontend tests (smoke)
- Run fast frontend-relevant test set for touched modules.
- Default command:
  - `npm run test`
- If suite is large, run targeted smoke subset first, then broader run if needed.

3. Optional scenario tests (when feature touches those domains)
- Vaccination logic: `npm run test:vaccination`
- Revaccination logic: `npm run test:revaccination`
- CDSS flows: `npm run test:cdss-cli`

## Pass Criteria

Testing stage is PASS only when all conditions are true:
- Targeted unit tests pass.
- Basic frontend smoke tests pass for affected area.
- No newly introduced failing tests in touched scope.
- Failures (if any) are documented with actionable diagnosis.

## Failure Workflow

If tests fail:
1. Capture exact failing test names and error output.
2. Classify failure type:
- Regression from new code.
- Existing flaky/unrelated failure.
- Environment/config issue.
3. Propose minimal fix.
4. Re-run failed tests and then affected smoke tests.
5. Repeat until pass or user explicitly accepts known failure.

Do not mark task stage done while failing tests remain unexplained.

## Output Contract (Mandatory)

Provide report in this order:

1. Test Plan
- What was run and why.

2. Testing Decision
- New functionality or not.
- Whether testing was mandatory or user-approved.

3. Execution Summary
- Command: <cmd>
- Result: PASS/FAIL
- Scope: <module/files>

4. Failures (if any)
- Test: <name>
- Error: <short message>
- Suspected cause: <reason>
- Fix proposal: <minimal action>

5. Final Gate
- `READY_TO_CLOSE` when criteria are met.
- `BLOCKED_BY_TESTS` when criteria are not met.
- `SKIPPED_BY_USER_APPROVAL` when testing was not mandatory and user declined.

## Integration with Task Lifecycle

When used with task orchestration:
- Update task stage status in task file.
- Add execution log entry with timestamp and test results.
- Allow task closure only after final gate `READY_TO_CLOSE`.

Also provide test outcome to `release-readiness-gate` as mandatory evidence.

## Guardrails

- Do not skip mandatory tests for new functionality.
- For non-feature changes, ask before skipping tests and record the user decision.
- Do not hide flaky tests; mark them as risk.
- Do not run only broad suites if targeted tests can isolate failures faster.
- Keep reruns focused to reduce feedback cycle time.

## Fast Prompts

Use this skill for prompts like:
- "Прогони unit и базовые фронтенд тесты после реализации"
- "Run post-implementation tests for TASK-001"
- "Проверь, можно ли закрывать задачу по результатам тестов"
