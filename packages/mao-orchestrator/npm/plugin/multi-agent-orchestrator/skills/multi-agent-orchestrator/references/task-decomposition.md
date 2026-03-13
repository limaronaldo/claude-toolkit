# Task Decomposition Reference

## Principles

Good decomposition follows these principles:

1. **Atomic** — Each task can be completed by one agent without coordinating with others
2. **Independent** — Tasks sharing no files can run in parallel
3. **Verifiable** — Every task has concrete acceptance criteria
4. **Right-sized** — Big enough to be meaningful (~10-100 lines of code), small enough to be focused

## Decomposition Process

### Step 1: Identify Concerns

Map the user's request to distinct concerns:

```
"Implement JWT auth with refresh tokens"
→ Data layer (schema, migrations)
→ Auth logic (token generation, validation, refresh)
→ Middleware (request interception, token extraction)
→ API endpoints (login, refresh, logout)
→ Tests (unit + integration)
→ Documentation (API docs)
```

### Step 2: Group Into Tasks

Each concern becomes 1-3 tasks based on complexity:

```
T1: Create auth schema (migration + models)        → 1 task, low complexity
T2: Implement token generation + validation         → 1 task, medium
T3: Implement refresh token rotation                → 1 task, high (security)
T4: Create auth middleware                          → 1 task, medium
T5: Create auth API endpoints                       → 1 task, medium (deps: T2, T4)
T6: Write unit tests                                → 1 task, low
T7: Write integration tests                         → 1 task, medium (deps: T5)
T8: Update API documentation                        → 1 task, trivial
```

### Step 3: Map Dependencies

Draw the DAG. A task depends on another only if it CANNOT start without the other's output:

```
T1 ──→ T2 ──→ T5 ──→ T7
       ↑       ↑
T1 ──→ T3     T4
                ↑
               T1

T6 depends on T2 (needs token functions to test)
T8 depends on T5 (needs endpoint definitions)
```

Key question: "Can agent B start WITHOUT agent A's output?" If yes, no dependency.

### Step 4: Score Complexity

For each task, evaluate:

| Factor | Score | Description |
|--------|-------|-------------|
| `files_touched` | ×1 | More than 2 files involved |
| `new_logic` | ×3 | Creating new algorithms or business rules |
| `security_risk` | ×5 | Auth, encryption, access control, data exposure |
| `concurrency` | ×5 | Race conditions, locks, async coordination |

Total = sum of applicable factors.

### Step 5: Assign Models

| Score | Model | Rationale |
|-------|-------|-----------|
| 0-3 | haiku | Pattern is clear, solution is mechanical |
| 4-7 | sonnet | Requires reasoning but solution space is bounded |
| 8+ | opus | Novel design, security-critical, or complex coordination |

### Step 6: Check for Conflicts

If two parallel tasks touch the same file, they WILL create merge conflicts.
Options:
- Make them sequential (add a dependency)
- Split the file changes so each task owns different sections
- Accept the conflict and let the merge resolver handle it

## Common Decomposition Patterns

### API Feature
```
Schema → Service Logic → API Endpoints → Tests → Docs
```

### Refactoring
```
Extract Interface → Update Implementations (parallel) → Update Tests → Update Consumers
```

### Data Pipeline
```
Ingestion → Transformation → Validation → Storage → Monitoring
```

### Frontend Feature
```
Data Types → API Client → Components (parallel) → Integration → E2E Tests
```

## Anti-Patterns

- **Too granular**: "Rename variable X" is not a task — it's part of a larger change
- **Too coarse**: "Build the entire auth system" defeats the purpose of decomposition
- **Hidden deps**: Tasks that look independent but actually share state or files
- **Missing verification**: Tasks without acceptance criteria can't be verified
- **Over-decomposition**: More than 15 tasks usually means the feature should be split into multiple feature-level decompositions
