# Claude Primer — VS Code Extension

Prime your repo for Claude Code, directly from VS Code.

## Commands

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and search for:

| Command | Description |
|---|---|
| **Claude Primer: Generate** | Run claude-primer on the current workspace |
| **Claude Primer: Dry Run** | Preview what would be generated without writing files |
| **Claude Primer: Show Diff** | Show a diff of what would change |
| **Claude Primer: Init Config** | Interactive config wizard using VS Code UI |
| **Claude Primer: Plan JSON** | View the project analysis plan in a webview panel |

## Requirements

You need `claude-primer` installed and available. The extension checks in order:

1. `claude-primer` on your PATH (pip/pipx install)
2. `npx claude-primer` (npm)
3. `pipx run claude-primer`

Install with any of:

```bash
pip install claude-primer
pipx install claude-primer
npm install -g claude-primer
```

## License

MIT
