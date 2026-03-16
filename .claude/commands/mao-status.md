---
description: Check status of a multi-agent orchestration run
---
# MAO Status

Read the current MAO orchestration state and present a clear status report.

## Instructions

1. **Read the task graph:**
   ```bash
   cat .orchestrator/state/task-graph.json
   ```
   If the file doesn't exist, report: "No active MAO run in this project. Use `/mao-plan <task>` to create one or `/mao <task>` to plan and execute."

2. **Present the status report:**

   **Intent:** (from task-graph.json `intent` field)

   **Progress:** X/Y tasks complete

   **Task Board:**
   ```
   | ID | Task | Status | Model | Attempts | Error |
   |----|------|--------|-------|----------|-------|
   | T1 | ... | done | haiku | 1 | — |
   | T2 | ... | running | sonnet | 1 | — |
   | T3 | ... | pending | haiku | 0 | — |
   | T4 | ... | failed | sonnet | 2 | brief error |
   ```

   **DAG Waves:**
   Show which wave is currently executing and which are complete/pending.

   **Escalation Log:** (if any escalations occurred)
   List each escalation: task, from model, to model, reason, resolved?

3. **Read metrics if available:**
   ```bash
   cat .orchestrator/state/metrics.json
   ```
   If present, show: model distribution, total duration, retry count.

4. **Read artifacts for failed tasks:**
   For any task with status "failed", read its test results:
   ```bash
   cat .orchestrator/artifacts/{task_id}/test-results.json
   ```
   Summarize what went wrong and suggest next steps.

5. **Summary:**
   - If all tasks done: "Run complete. All tasks succeeded." or note any issues.
   - If tasks running: "In progress. X tasks running, Y pending."
   - If tasks failed: "Blocked. Task(s) TX failed. Consider re-running `/mao` or manually fixing."
