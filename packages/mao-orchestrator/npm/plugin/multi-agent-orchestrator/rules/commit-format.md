# Commit Format

Follow conventional commits with MAO-specific conventions.

## Format

```
type(scope): description

[optional body]
```

## Types

- `feat`: new feature or capability
- `fix`: bug fix
- `refactor`: code restructuring without behavior change
- `test`: adding or updating tests
- `docs`: documentation changes
- `chore`: maintenance, config, tooling
- `perf`: performance improvement

## Scope

Use the task ID when working within a MAO orchestration:

```
feat(T3): add user authentication middleware
fix(T7): resolve race condition in batch processor
test(T3): add integration tests for auth middleware
```

For non-orchestrated work, use the module or feature name:

```
feat(auth): add OAuth2 provider support
fix(api): handle null response from upstream
```

## Rules

- Keep the first line under 72 characters
- Use imperative mood: "add" not "added", "fix" not "fixes"
- Reference the task ID in orchestrated workflows
- One logical change per commit
- Do not add Co-Authored-By trailers
- Do not add Signed-off-by trailers unless the project requires DCO
