# TDD Context Whiteboard

The whiteboard replaces conversational history with a structured, typed state object.
Each agent reads only the fields it needs and writes only the fields it owns.

## Why Not Chat History

Appending every agent's output into a growing transcript causes:
- Context window bloat and token waste
- LLM confusion from stale intermediate states
- Inability to distinguish authoritative facts from failed attempts
- Loss of control over what each agent can see and modify

The whiteboard fixes this by storing **artifacts, not thoughts**.

## Whiteboard Structure

The whiteboard is a JSON object with four zones. Each zone has different
read/write permissions per TDD phase.

### Zone A: Contract (immutable after RED begins)

The durable truth of the task.

```json
{
  "feature_specification": "Original task description from the orchestrator",
  "acceptance_criteria": ["criterion 1", "criterion 2"],
  "scope_boundary": ["files in scope"],
  "public_api_expectations": "What the public interface should look like",
  "target_behavior": "The specific behavioral claim being tested in this cycle",
  "architectural_constraints": ["use existing patterns", "no new deps"]
}
```

This layer is mostly immutable. If the contract shifts, the loop stops being TDD
and becomes moving-target synthesis.

### Zone B: Evidence (deterministic, environment-authored)

Machine-verifiable artifacts produced by the test runner and compiler. This is the
most important zone because it replaces vague agent memory with hard facts.

```json
{
  "test_command": "npm test -- --grep 'auth middleware'",
  "exit_code": 1,
  "compiler_output": "exact stderr here",
  "failing_assertion": "Expected 401 but got 200",
  "stack_trace": "at AuthMiddleware.verify (src/auth.ts:42)",
  "test_names_passed": ["login.success", "login.invalid-password"],
  "test_names_failed": ["login.expired-token"],
  "changed_files": ["src/auth.ts", "tests/auth.test.ts"]
}
```

Only the framework writes this zone. Agents consume it read-only.

### Zone C: Intent (compact, LLM-authored)

What the current agent was trying to do. Must be brief and structured.

```json
{
  "phase": "RED|GREEN|REFACTOR",
  "behavioral_hypothesis": "Expired JWT tokens should return 401",
  "implementation_strategy": "Add expiry check before signature validation",
  "cleanup_objective": "Extract token parsing into helper function",
  "invariants_promised": ["Public API unchanged", "No new dependencies"]
}
```

Each agent writes only its relevant fields. The Test Engineer writes
`behavioral_hypothesis`. The Coder writes `implementation_strategy`.
The Refactor agent writes `cleanup_objective` and `invariants_promised`.

### Zone D: Workspace (framework-managed)

Current state of the working tree and patch history.

```json
{
  "workspace_snapshot_id": "abc123",
  "repo_root": "/path/to/worktree",
  "relevant_files": [
    { "path": "src/auth.ts", "spans": [{"start": 35, "end": 55}] }
  ],
  "protected_files": ["src/auth.ts"],
  "patch_set": [],
  "patch_apply_result": "success|partial|failed",
  "last_green_snapshot_id": "def456",
  "retry_count": 0
}
```

`protected_files` enforces boundaries: tests are read-only in GREEN,
implementation is read-only in RED.

`last_green_snapshot_id` enables instant rollback when REFACTOR breaks behavior.

## Whiteboard Location

During orchestration, the whiteboard is stored at:
```
.orchestrator/artifacts/{task_id}/whiteboard.json
```

Each state transition produces a checkpoint:
```
.orchestrator/artifacts/{task_id}/whiteboard-RED-1.json
.orchestrator/artifacts/{task_id}/whiteboard-GREEN-1.json
.orchestrator/artifacts/{task_id}/whiteboard-REFACTOR-1.json
.orchestrator/artifacts/{task_id}/whiteboard-RED-2.json
```

Snapshot-based, not overwrite-based. This gives reversibility and auditability.

## Permission Matrix

Each phase has strict read/write permissions:

| Zone | RED (Tester) | GREEN (Coder) | REFACTOR (Optimizer) |
|------|-------------|---------------|---------------------|
| A: Contract | Read | Read | Read |
| B: Evidence | Read (after test run) | Read | Read |
| C: Intent | Write `behavioral_hypothesis` | Write `implementation_strategy` | Write `cleanup_objective` |
| D: Workspace | Write test files only | Write impl files only | Write impl files only |

### Authority Boundaries

- The Test Engineer can write tests but cannot mark the system GREEN. Only the
  environment (test runner exit code) can do that.
- The Coder can write implementation but cannot redefine acceptance criteria.
- The Refactor agent can improve structure but cannot expand scope or alter
  the behavioral contract.
- No agent can overwrite Zone B. Only the framework's test execution step can.

## Derived Views

Each agent gets a tailored projection of the whiteboard, not the full object.

### Test Engineer sees:
- Feature contract (Zone A)
- Existing relevant tests
- Current gaps (behaviors not yet tested)

### Coder sees:
- Failing test code and name
- Exact failure evidence (Zone B)
- Implementation files in scope (Zone D spans)
- Nothing from the Test Engineer's reasoning

### Refactor Agent sees:
- Passing checkpoint code
- Style and quality goals
- Hard statement: "public behavior is frozen"
- Nothing from previous failed attempts

## Six Questions the Whiteboard Answers

At all times, the whiteboard answers:

1. **What behavior** is being added?
2. **Which test** currently expresses that behavior?
3. **Why** the current state is RED, GREEN, or REFACTOR?
4. **What deterministic evidence** supports that state?
5. **What files** are in scope?
6. **What** the next agent is **allowed to change**?

## Invariants

These are enforced at the orchestration level:

1. A GREEN state is only valid if backed by a successful deterministic test run
   (exit code 0, all assertions pass).
2. A transition from RED to GREEN must reference the same target test contract.
3. A REFACTOR state may not modify the stored behavior contract.
4. Compiler error in RED → return to Test Engineer (invalid test).
5. Compiler error in GREEN → return to Coder (incomplete implementation).
6. Any failure in REFACTOR → restore previous GREEN checkpoint automatically.
7. Retry always means recompute from current truth, not continue from old thoughts.
