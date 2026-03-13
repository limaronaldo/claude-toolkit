"""Property-based tests for claude-primer core functions."""
import json
import os
import random
import string
import tempfile
import subprocess
from pathlib import Path

SCRIPT = Path(__file__).parent.parent / "claude_primer.py"


def random_package_json():
    """Generate a random but valid package.json."""
    deps = random.sample([
        "express", "react", "vue", "angular", "fastify", "koa",
        "next", "nuxt", "svelte", "django", "flask", "rails",
        "typescript", "webpack", "vite", "esbuild", "rollup",
        "jest", "mocha", "vitest", "pytest", "eslint", "prettier",
    ], k=random.randint(1, 6))

    name = "".join(random.choices(string.ascii_lowercase, k=8))
    pkg = {
        "name": name,
        "version": "1.0.0",
        "dependencies": {d: "^1.0.0" for d in deps},
    }
    if random.random() > 0.5:
        scripts = {}
        if random.random() > 0.5:
            scripts["test"] = random.choice(["jest", "vitest", "mocha", "pytest"])
        if random.random() > 0.5:
            scripts["build"] = random.choice(["tsc", "webpack", "vite build", "next build"])
        if scripts:
            pkg["scripts"] = scripts
    return pkg


def run_primer(*args):
    return subprocess.run(
        ["python3", str(SCRIPT), *args],
        capture_output=True, text=True, timeout=30,
    )


class TestPropertyBased:
    def test_always_generates_claude_md(self):
        """CLAUDE.md should always be generated regardless of project content."""
        for _ in range(10):
            with tempfile.TemporaryDirectory() as tmp:
                pkg = random_package_json()
                with open(os.path.join(tmp, "package.json"), "w") as f:
                    json.dump(pkg, f)
                r = run_primer(tmp, "--yes", "--no-git-check")
                assert r.returncode == 0, f"Failed for {pkg}: {r.stderr}"
                assert os.path.exists(os.path.join(tmp, "CLAUDE.md")), f"No CLAUDE.md for {pkg}"

    def test_plan_json_always_valid(self):
        """--plan-json should always return valid JSON."""
        for _ in range(10):
            with tempfile.TemporaryDirectory() as tmp:
                pkg = random_package_json()
                with open(os.path.join(tmp, "package.json"), "w") as f:
                    json.dump(pkg, f)
                r = run_primer(tmp, "--plan-json", "--no-git-check")
                assert r.returncode == 0, f"Failed for {pkg}: {r.stderr}"
                data = json.loads(r.stdout)
                assert "stacks" in data
                assert "tier" in data
                assert "frameworks" in data

    def test_force_skips_unchanged(self):
        """Running twice with --force should skip unchanged files."""
        for _ in range(5):
            with tempfile.TemporaryDirectory() as tmp:
                pkg = random_package_json()
                with open(os.path.join(tmp, "package.json"), "w") as f:
                    json.dump(pkg, f)
                # First run generates files
                run_primer(tmp, "--yes", "--no-git-check")
                # Second run with --force — STANDARDS/QUICKSTART/ERRORS should be skipped
                r = run_primer(tmp, "--yes", "--no-git-check", "--force")
                assert r.returncode == 0, f"Failed for {pkg}: {r.stderr}"
                assert "SKIP" in r.stdout, f"Expected SKIP in output for {pkg}"

    def test_diff_never_crashes(self):
        """--diff should never crash regardless of project state."""
        for _ in range(10):
            with tempfile.TemporaryDirectory() as tmp:
                pkg = random_package_json()
                with open(os.path.join(tmp, "package.json"), "w") as f:
                    json.dump(pkg, f)
                # Some runs with existing files, some without
                if random.random() > 0.5:
                    run_primer(tmp, "--yes", "--no-git-check")
                r = run_primer(tmp, "--diff", "--no-git-check")
                assert r.returncode == 0, f"--diff crashed for {pkg}: {r.stderr}"

    def test_dry_run_writes_nothing(self):
        """--dry-run should never create any files."""
        for _ in range(10):
            with tempfile.TemporaryDirectory() as tmp:
                pkg = random_package_json()
                with open(os.path.join(tmp, "package.json"), "w") as f:
                    json.dump(pkg, f)
                before = set(os.listdir(tmp))
                run_primer(tmp, "--dry-run", "--yes", "--no-git-check")
                after = set(os.listdir(tmp))
                assert before == after, f"--dry-run created files: {after - before}"
