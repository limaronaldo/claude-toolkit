---
name: mao-review
description: >
  Performs structured code review across five dimensions: maintainability,
  security, performance, design, and completeness. Fixes issues before
  presenting code to the user — the review loop runs automatically, making
  every output a second draft, not a first. Triggers on "review", "code review",
  "check my code", or automatically after implementation tasks complete.
argument-hint: "[file, branch, or task to review]"
allowed-tools: Read, Glob, Grep, Bash(git diff*), Bash(git log*), Bash(git show*), Edit, Write
---

# MAO Review — Structured Code Review

Review code changes like a senior engineer who has maintained large codebases
for years. The goal is not just working code — it's code that holds up over time.

**Key principle**: Don't just flag problems — fix them. The review loop runs
before the code is presented to the user. What they receive is already the
second draft.

## Review Dimensions

### 0. Maintainability (run first — this is the most commonly missed dimension)

The biggest gap between agent-written code and expert-written code. Check for:

- **Functions > 30 lines**: likely doing too much — extract logical units
- **Logic duplicated more than twice**: extract to a shared utility
- **Unnecessary abstractions**: indirection that adds complexity without flexibility
- **Single responsibility violations**: functions/classes with multiple concerns
- **Inconsistent patterns**: new code that doesn't follow the existing codebase conventions
- **Naming that doesn't communicate intent**: `data`, `result`, `temp`, `handleStuff`
- **Dead code and unused imports**: anything unreachable or never referenced
- **TypeScript `any` usage**: replace with real types that encode intent
- **Component props > 3 that could be grouped**: extract into a typed object
- **Missing error handling on async operations**: unhandled promise rejections

**Fix-before-present examples:**

```typescript
// ❌ Before review — duplicated fetch pattern
const getUser = async (id: string) => {
  const res = await fetch(`/api/users/${id}`);
  const data = await res.json();
  return data;
};
const getPost = async (id: string) => {
  const res = await fetch(`/api/posts/${id}`);
  const data = await res.json();
  return data;
};

// ✅ After review — extracted utility, error handling added
const fetchResource = async (path: string) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};
const getUser = (id: string) => fetchResource(`/api/users/${id}`);
const getPost = (id: string) => fetchResource(`/api/posts/${id}`);
```

### 1. Security

Check for:
- **Input validation**: all user/external input validated at boundaries
- **Auth checks**: protected routes and resources verify authorization
- **Data exposure**: no secrets, tokens, or PII in logs, responses, or error messages
- **Injection**: no SQL injection, command injection, XSS, or path traversal
- **Error messages**: production errors don't leak internal details
- **Dependencies**: no known vulnerable versions

### 2. Performance

Check for:
- **N+1 queries**: database calls inside loops
- **Unnecessary re-renders**: missing memoization in React components with stable props
- **Unnecessary allocations**: large objects created repeatedly in hot paths
- **Missing indexes**: queries against unindexed fields
- **Pagination**: unbounded result sets
- **Blocking operations**: synchronous I/O where async alternatives exist

### 3. Design

Check for:
- **Coupling**: changes in one module shouldn't force changes elsewhere
- **Error handling**: errors caught at the right level, not swallowed silently
- **Duplication**: similar logic extracted into shared utilities (threshold: 2+ occurrences)
- **Consistency**: follows existing project patterns and conventions

### 4. Completeness

Check for:
- **Verification criteria met**: does the code actually do what the task specified?
- **Edge cases**: empty input, null, boundaries, concurrent access
- **Error paths**: what happens when external calls fail?
- **Tests**: adequate coverage for new code paths
- **Documentation**: public APIs documented, non-obvious logic commented
- **Migration/rollback**: data changes are reversible

## The Fix Loop

When issues are found:

1. **Fix immediately** for MEDIUM/LOW issues — don't just report them, apply the fix
2. **Report + fix** for HIGH issues — document what changed and why
3. **Block + create correction task** for CRITICAL issues — these require dedicated attention

Run `/simplify` as a final pass after fixing to catch any remaining quality gaps.

## Output Format

After fixes are applied, report what changed:

```
REVIEW COMPLETE

Fixed (applied automatically):
  [MEDIUM] design: Extracted duplicate fetch logic into fetchResource() utility
    Files: src/api/users.ts, src/api/posts.ts
  [LOW] naming: Renamed `data` → `userRecord` for clarity
    File: src/services/user.ts:14

Requires attention (not auto-fixed):
  [CRITICAL] security: JWT secret read from hardcoded fallback string
    File: src/auth/middleware.ts:8
    Fix: Use process.env.JWT_SECRET with startup validation — throw if missing

Verdict: CHANGES_REQUESTED | APPROVED_WITH_NOTES | APPROVED
```

Severity levels:
- **CRITICAL**: must fix before merge (security vulnerabilities, data loss risks)
- **HIGH**: should fix before merge (performance issues, design violations)
- **MEDIUM**: fix in this pass (code quality, duplication, naming)
- **LOW**: fix in this pass if trivial (consistency, unused imports)

## Verdicts

| Verdict | Meaning |
|---------|---------|
| **APPROVED** | No remaining issues after fixes applied. |
| **APPROVED_WITH_NOTES** | Only LOW/MEDIUM fixed; follow-up tasks created for anything deferred. |
| **CHANGES_REQUESTED** | CRITICAL or HIGH issues remain that couldn't be auto-fixed. |

## Integration with MAO

When running as part of a MAO orchestration:
- Reviews happen in Phase 6, after verification passes
- CRITICAL/HIGH findings generate correction tasks that re-enter Phase 4
- MEDIUM/LOW fixes are applied in-place before the task is marked complete
- Reviews focus on cross-agent concerns: are the pieces consistent with each other?

When running standalone:
- Review `git diff`, a specific branch, or named files
- Apply MEDIUM/LOW fixes directly
- Report CRITICAL/HIGH findings with specific remediation steps
