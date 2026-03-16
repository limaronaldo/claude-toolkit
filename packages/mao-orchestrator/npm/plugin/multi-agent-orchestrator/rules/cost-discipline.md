# Cost Discipline

Route tasks to the appropriate model based on the active quality level.

## Quality Levels

### Standard (default)

Optimize for cost — use the cheapest model that can solve each task.

- **Haiku (40-50%)**: boilerplate, CRUD, config files, type definitions, formatting, simple verification
- **Sonnet (40-45%)**: business logic, APIs, middleware, refactoring, code review, orchestration
- **Opus (5-15%)**: architecture, decomposition, security-critical code, novel algorithms, meta-reflection

### Quality (`--quality`)

Optimize for output quality — shift tasks up one model tier.

- **Sonnet (40-50%)**: boilerplate, CRUD, config files, type definitions, verification
- **Opus (50-60%)**: everything else — features, business logic, APIs, review, architecture

## Rules

### Standard level
- If more than 30% of tasks route to Opus, re-examine — likely over-scored
- Never use Opus for mechanical tasks (renaming, moving files, updating imports)
- Never use Opus for running tests or linting
- Sonnet is the default — only escalate to Opus when the task genuinely requires deep reasoning
- Haiku is preferred for any task that has a clear, deterministic procedure
- 3-5 Opus invocations per run is the budget

### Quality level
- Haiku is never used — minimum model is Sonnet
- Opus is the default for anything involving logic, not just deep reasoning
- Verification uses Sonnet instead of Haiku
- Code review uses Opus instead of Sonnet
- Up to 15 Opus invocations per run

### Both levels
- After orchestration, log the actual model distribution and compare to targets
- If the user specifies a level, use it; otherwise default to standard

## Cost Awareness

- 1 Opus call costs roughly 10x a Haiku call
- Standard: expected savings vs all-Opus: 60-70%
- Quality: expected savings vs all-Opus: 20-30%

## Context Management

Avoid the last 20% of the context window for:
- Large-scale refactoring
- Feature implementation spanning multiple files
- Debugging complex interactions

Lower context sensitivity tasks (safe near the window limit):
- Single-file edits
- Independent utility creation
- Documentation updates
- Simple bug fixes

### Extended Thinking

Extended thinking is enabled by default, reserving up to 31,999 tokens for internal reasoning.

Control extended thinking via:
- **Toggle**: Option+T (macOS) / Alt+T (Windows/Linux)
- **Config**: Set `alwaysThinkingEnabled` in `~/.claude/settings.json`
- **Budget cap**: `export MAX_THINKING_TOKENS=10000`
- **Verbose mode**: Ctrl+O to see thinking output

For complex tasks requiring deep reasoning:
1. Ensure extended thinking is enabled (on by default)
2. Enable **Plan Mode** for structured approach
3. Use multiple critique rounds for thorough analysis
4. Use split role sub-agents for diverse perspectives
