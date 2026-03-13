# Patch Protocol Reference

Agents propose minimal, typed patch operations instead of regenerating full files.
The framework validates and applies patches deterministically.

## Core Principle

Never ask an agent to return "the new file."

Ask it to return "the smallest valid patch set that transforms the current workspace
into the next state."

The canonical unit of work is a patch object tied to a specific workspace snapshot,
not source code.

## Why Not Full-File Regeneration

Full-file output is the biggest failure mode in agentic coding:
- Amplifies drift (unintended changes far from the edit point)
- Bloats context (sending/receiving thousands of lines)
- Creates accidental edits outside the intended scope
- Makes review harder (entire file vs. targeted diff)

## Patch Object Schema

Each patch operation contains:

```json
{
  "file_path": "src/auth/middleware.ts",
  "operation": "replace_block",
  "anchor_context": "function verifyToken(token: string)",
  "old_text": "  return jwt.verify(token, SECRET);",
  "new_text": "  const decoded = jwt.verify(token, SECRET);\n  if (decoded.exp < Date.now() / 1000) throw new TokenExpiredError();",
  "preconditions": [
    { "type": "function_exists", "name": "verifyToken" },
    { "type": "file_contains", "text": "jwt.verify" }
  ],
  "rationale": "Add expiry check before returning decoded token"
}
```

### Fields

| Field | Required | Purpose |
|-------|----------|---------|
| `file_path` | yes | Target file relative to repo root |
| `operation` | yes | One of the five safe edit operations |
| `anchor_context` | yes | Stable nearby code for locating the edit |
| `old_text` | for replace/delete | Exact text being replaced or removed |
| `new_text` | for replace/insert/create | Text to insert |
| `preconditions` | recommended | Conditions that must hold for the patch to be valid |
| `rationale` | recommended | Why this change is needed (for audit trail) |

## Safe Edit Vocabulary

Start with five operations. This covers most TDD work while keeping
application deterministic.

| Operation | Description |
|-----------|-------------|
| `create_file` | Create a new file with given content |
| `replace_block` | Replace exact `old_text` with `new_text` at anchor |
| `insert_before_anchor` | Insert `new_text` before the anchor line |
| `insert_after_anchor` | Insert `new_text` after the anchor line |
| `delete_block` | Remove exact `old_text` at anchor |

Do not invent arbitrary file mutations. This restricted vocabulary
keeps application predictable and reviewable.

## Patch Application Sequence

The framework follows this deterministic sequence:

```
1. PREFLIGHT
   ├── Verify snapshot_id matches current workspace
   ├── Confirm target file exists (or doesn't, for create_file)
   ├── Check all preconditions
   └── Verify anchors still match

2. DRY RUN
   ├── Apply patch in memory
   ├── If anchor mismatch → REJECT (rebuild context, regenerate)
   └── If clean → proceed

3. APPLY
   └── Write changes to disk

4. VALIDATE (deterministic gates, in order)
   ├── Parse (syntax check)
   ├── Format (if auto-formatter configured)
   ├── Type-check / compile
   └── Test

5. UPDATE STATE
   ├── New workspace snapshot
   ├── Update whiteboard Zone B (evidence)
   └── Route to next state machine step
```

If any step fails, the framework does NOT ask the model to "try again from memory."
It rebuilds a fresh focused packet from the current state and asks for a new patch
against that state. Retry = recompute from current truth.

## Context Retrieval for Agents

An agent should almost never receive a full file. Instead, provide:

### Per relevant file:
- File path
- Compact symbol index (function names, class names, exports)
- Target span (the lines the agent needs to edit)
- Leading/trailing context (5-10 lines around the span)
- Directly related tests
- Directly related compiler/runtime errors

### Why this matters:
- If a patch fails because the wrong span was retrieved, that is a **retrieval
  error**, not a coding error. Rerun retrieval, not the coder.
- This separation is one of the biggest advantages of the whiteboard model.

## Scope Enforcement per TDD Phase

The patch engine enforces which files each phase can modify:

| Phase | Can Patch | Read-Only |
|-------|-----------|-----------|
| RED (Tester) | Test files only | Implementation files |
| GREEN (Coder) | Implementation files only | Test files |
| REFACTOR (Optimizer) | Implementation files only | Test files, public API contracts |

If an agent proposes a patch outside its allowed scope, reject before application.

## Failure Modes

Four common patch failures and how to handle each:

### 1. Stale Base State
The patch was generated against an old snapshot.
**Action:** Reject immediately. Rebuild context from current state.

### 2. Anchor Mismatch
The target block moved or changed since the agent saw it.
**Action:** Rebuild context with fresh file spans. Regenerate patch.

### 3. Overscoped Edit
The patch touches unrelated files or too many lines.
**Action:** Reject on policy grounds before application. Ask agent to
produce a more focused patch.

### 4. Post-Apply Regression
The patch applies cleanly but breaks compile or tests.
**Action:** This is a real implementation failure. Route back to the
state machine (retry or escalate per self-correction protocol).

This separation lets you diagnose whether the problem was retrieval,
patch construction, or actual coding logic.

## Integration with Claude Code Tools

In practice within Claude Code, patches map to existing tools:

| Operation | Tool |
|-----------|------|
| `create_file` | Write |
| `replace_block` | Edit (old_string → new_string) |
| `insert_before_anchor` | Edit |
| `insert_after_anchor` | Edit |
| `delete_block` | Edit (old_string → empty new_string) |

The conceptual patch protocol guides agent behavior even when using
standard Claude Code tools. The agent should:

1. Read only the relevant spans (not entire files)
2. Propose minimal edits (not rewrite files)
3. State preconditions in reasoning (what must be true for this edit to work)
4. Verify after each edit (run tests)

## Architecture Summary

```
whiteboard stores truth
  → retrieval builds focused context
    → agent proposes typed minimal patch
      → framework applies deterministically
        → environment verifies
          → state machine routes next step
```
