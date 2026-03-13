---
name: mao-review
description: >
  Performs structured code review across four dimensions: security, performance,
  design, and completeness. Use after implementation is done, before merging.
  Triggers on "review", "code review", "check my code", or when a task's
  verification step passes and needs a second pair of eyes.
argument-hint: "[file, branch, or task to review]"
allowed-tools: Read, Glob, Grep, Bash(git diff*), Bash(git log*), Bash(git show*)
---

# MAO Review — Structured Code Review

Review code changes like a senior engineer. Evaluate across four dimensions,
produce actionable findings, and generate correction tasks for issues found.

## Review Dimensions

### Security

Check for:
- **Input validation**: all user/external input validated at boundaries
- **Auth checks**: protected routes and resources verify authorization
- **Data exposure**: no secrets, tokens, or PII in logs, responses, or error messages
- **Injection**: no SQL injection, command injection, XSS, or path traversal
- **Error messages**: production errors don't leak internal details
- **Dependencies**: no known vulnerable versions

### Performance

Check for:
- **N+1 queries**: database calls inside loops
- **Unnecessary allocations**: large objects created repeatedly in hot paths
- **Missing indexes**: queries against unindexed fields
- **Pagination**: unbounded result sets
- **Caching**: repeated expensive computations without memoization
- **Async**: blocking calls where async alternatives exist

### Design

Check for:
- **Single responsibility**: each function/class does one thing
- **Coupling**: changes in one module shouldn't force changes elsewhere
- **Error handling**: errors caught at the right level, not swallowed
- **Naming**: variables, functions, and files clearly describe their purpose
- **Duplication**: similar logic extracted into shared utilities
- **Consistency**: follows existing project patterns and conventions

### Completeness

Check for:
- **Verification criteria met**: does the code actually do what the task specified?
- **Edge cases**: empty input, null, boundaries, concurrent access
- **Error paths**: what happens when things go wrong?
- **Tests**: adequate test coverage for new code
- **Documentation**: public APIs documented, complex logic commented
- **Migration/rollback**: data changes are reversible

## Output Format

For each issue found:

```
[SEVERITY] category: description
  File: path/to/file.ts:42
  Suggestion: how to fix it
```

Severity levels:
- **CRITICAL**: must fix before merge (security vulnerabilities, data loss risks)
- **HIGH**: should fix before merge (performance issues, design violations)
- **MEDIUM**: fix soon (code quality, missing tests)
- **LOW**: nice to have (naming, style consistency)

## Verdicts

After reviewing all dimensions, issue one of:

| Verdict | Meaning |
|---------|---------|
| **APPROVED** | No issues or only LOW findings. Safe to merge. |
| **APPROVED_WITH_NOTES** | MEDIUM findings that can be addressed in a follow-up. |
| **CHANGES_REQUESTED** | HIGH or CRITICAL findings. Must fix before merging. |

## Integration with MAO

When running as part of a MAO orchestration:

- Reviews happen in Phase 5, after verification passes
- Each completed task gets reviewed by a `mao-reviewer` agent
- CRITICAL/HIGH findings generate correction tasks that re-enter Phase 3
- Reviews focus on cross-agent concerns: are the pieces consistent with each other?

When running standalone:
- Review the current diff (`git diff`), a specific branch, or specific files
- Present findings to the user with suggested fixes
- Offer to create the fixes directly if approved
