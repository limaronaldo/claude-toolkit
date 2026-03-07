#!/usr/bin/env python3
"""
Tests for claude_setup.py (claude.py)

Regression suite + golden output tests.
Run: python3 -m pytest test_claude_setup.py -v
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent / "super_claude.py"


def run_setup(*args, cwd=None, timeout=30):
    """Run claude.py with given args, return CompletedProcess."""
    cmd = ["python3", str(SCRIPT)] + list(args)
    return subprocess.run(
        cmd, capture_output=True, text=True,
        cwd=cwd, timeout=timeout,
    )


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

@pytest.fixture
def empty_dir(tmp_path):
    """An empty temporary directory."""
    return tmp_path


@pytest.fixture
def python_project(tmp_path):
    """A minimal Python project."""
    (tmp_path / "requirements.txt").write_text("requests==2.31.0\n")
    (tmp_path / "main.py").write_text("print('hello')\n")
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "test_main.py").write_text("def test_ok(): assert True\n")
    return tmp_path


@pytest.fixture
def node_project(tmp_path):
    """A minimal Node.js project."""
    pkg = {
        "name": "test-app",
        "version": "1.0.0",
        "scripts": {"test": "jest", "start": "node index.js", "build": "tsc"},
        "dependencies": {"express": "^4.18.0"},
    }
    (tmp_path / "package.json").write_text(json.dumps(pkg, indent=2))
    (tmp_path / "index.js").write_text("const express = require('express');\n")
    return tmp_path


@pytest.fixture
def monorepo_project(tmp_path):
    """A turborepo-style monorepo."""
    (tmp_path / "turbo.json").write_text('{"pipeline": {}}\n')
    pkg = {"name": "root", "private": True, "workspaces": ["apps/*", "packages/*"]}
    (tmp_path / "package.json").write_text(json.dumps(pkg, indent=2))

    apps = tmp_path / "apps" / "web"
    apps.mkdir(parents=True)
    (apps / "package.json").write_text('{"name": "web"}\n')
    next_cfg = apps / "next.config.js"
    next_cfg.write_text("module.exports = {};\n")

    pkgs = tmp_path / "packages" / "ui"
    pkgs.mkdir(parents=True)
    (pkgs / "package.json").write_text('{"name": "ui"}\n')
    (pkgs / "Button.tsx").write_text("export default function Button() {}\n")

    return tmp_path


@pytest.fixture
def git_repo(tmp_path):
    """A git-initialized empty repo."""
    subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, capture_output=True)
    # Initial commit so branch exists
    (tmp_path / ".gitkeep").write_text("")
    subprocess.run(["git", "add", "."], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=tmp_path, capture_output=True)
    return tmp_path


# ─────────────────────────────────────────────
# Regression tests
# ─────────────────────────────────────────────

class TestBasicBehavior:
    """Core behavior: create, skip, force, dry-run."""

    def test_empty_dir_creates_all_files(self, empty_dir):
        r = run_setup(str(empty_dir), "--yes", "--no-git-check")
        assert r.returncode == 0
        for f in ["CLAUDE.md", "QUICKSTART.md", "STANDARDS.md", "ERRORS_AND_LESSONS.md"]:
            assert (empty_dir / f).exists(), f"{f} not created"

    def test_skip_existing_without_force(self, empty_dir):
        # First run: create
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        # Mark files with known content
        (empty_dir / "CLAUDE.md").write_text("custom content\n")
        # Second run: skip
        r = run_setup(str(empty_dir), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert "SKIP" in r.stdout
        assert (empty_dir / "CLAUDE.md").read_text() == "custom content\n"

    def test_force_overwrites_existing(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        (empty_dir / "CLAUDE.md").write_text("custom content\n")
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--force")
        assert r.returncode == 0
        assert "OVERWRITE" in r.stdout
        assert (empty_dir / "CLAUDE.md").read_text() != "custom content\n"

    def test_dry_run_writes_nothing(self, empty_dir):
        r = run_setup(str(empty_dir), "--dry-run", "--yes")
        assert r.returncode == 0
        assert "DRY RUN" in r.stdout
        for f in ["CLAUDE.md", "QUICKSTART.md", "STANDARDS.md", "ERRORS_AND_LESSONS.md"]:
            assert not (empty_dir / f).exists(), f"{f} should not exist in dry-run"

    def test_dry_run_missing_target(self):
        with tempfile.TemporaryDirectory() as td:
            missing = Path(td) / "nonexistent"
            r = run_setup(str(missing), "--dry-run", "--yes")
            assert r.returncode == 0
            assert not missing.exists()

    def test_with_readme_generates_readme(self, empty_dir):
        r = run_setup(str(empty_dir), "--yes", "--no-git-check", "--with-readme")
        assert r.returncode == 0
        assert (empty_dir / "README.md").exists()

    def test_without_readme_no_readme(self, empty_dir):
        r = run_setup(str(empty_dir), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert not (empty_dir / "README.md").exists()


class TestStackDetection:
    """Stack and framework detection."""

    def test_python_detected(self, python_project):
        r = run_setup(str(python_project), "--plan-json")
        data = json.loads(r.stdout)
        assert "python" in data["stacks"]

    def test_node_detected(self, node_project):
        r = run_setup(str(node_project), "--plan-json")
        data = json.loads(r.stdout)
        assert "node" in data["stacks"]

    def test_express_framework_detected(self, node_project):
        r = run_setup(str(node_project), "--plan-json")
        data = json.loads(r.stdout)
        assert "express" in data["frameworks"]

    def test_empty_dir_no_stacks(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        assert data["stacks"] == []
        assert data["frameworks"] == []


class TestTierDetection:
    """Project tier classification."""

    def test_empty_is_t4(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        assert data["tier"]["tier"] == 4

    def test_python_is_t3(self, python_project):
        r = run_setup(str(python_project), "--plan-json")
        data = json.loads(r.stdout)
        assert data["tier"]["tier"] == 3

    def test_node_express_is_t2(self, node_project):
        r = run_setup(str(node_project), "--plan-json")
        data = json.loads(r.stdout)
        # express is external-facing → T2
        assert data["tier"]["tier"] == 2

    def test_monorepo_with_framework_and_deploy_is_t1(self, monorepo_project):
        # Add deploy signal + framework config at root level
        (monorepo_project / "Dockerfile").write_text("FROM node:18\n")
        (monorepo_project / "next.config.js").write_text("module.exports = {};\n")
        r = run_setup(str(monorepo_project), "--plan-json")
        data = json.loads(r.stdout)
        assert data["tier"]["tier"] == 1


class TestMonorepo:
    """Monorepo detection."""

    def test_turborepo_detected(self, monorepo_project):
        r = run_setup(str(monorepo_project), "--plan-json")
        data = json.loads(r.stdout)
        assert data["is_monorepo"] is True
        assert data["monorepo_tool"] == "turborepo"

    def test_workspace_dirs_found(self, monorepo_project):
        r = run_setup(str(monorepo_project), "--plan-json")
        data = json.loads(r.stdout)
        assert "apps" in data["workspace_dirs"] or len(data["sub_projects"]) > 0


class TestGitIntegration:
    """Git safety and detection."""

    def test_git_repo_detected(self, git_repo):
        r = run_setup(str(git_repo), "--plan-json")
        data = json.loads(r.stdout)
        assert data["has_git"] is True
        assert data["git"]["is_git"] is True

    def test_non_git_dir(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        assert data["has_git"] is False
        assert data["git"]["is_git"] is False

    def test_no_git_check_skips_git(self, git_repo):
        # Create a file, dirty the repo
        (git_repo / "dirty.txt").write_text("dirty\n")
        r = run_setup(str(git_repo), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert (git_repo / "CLAUDE.md").exists()

    def test_git_safety_skipped_when_no_overwrites(self, git_repo):
        """When all files will be created (not overwritten), git safety should be skipped."""
        r = run_setup(str(git_repo), "--yes")
        assert r.returncode == 0
        # Should succeed without git prompts since nothing is being overwritten
        assert (git_repo / "CLAUDE.md").exists()


class TestPlanJson:
    """--plan-json flag."""

    def test_valid_json_output(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        assert r.returncode == 0
        data = json.loads(r.stdout)
        assert "target" in data
        assert "stacks" in data
        assert "write_plan" in data
        assert "git" in data
        assert "tier" in data

    def test_no_files_written(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        assert r.returncode == 0
        for f in ["CLAUDE.md", "QUICKSTART.md", "STANDARDS.md", "ERRORS_AND_LESSONS.md"]:
            assert not (empty_dir / f).exists()

    def test_write_plan_reflects_existing(self, empty_dir):
        # Create some files first
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        # Now plan-json should show "skip" for existing files
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        for wp in data["write_plan"]:
            assert wp["mode"] == "skip"
            assert wp["exists"] is True

    def test_write_plan_create_for_new(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        for wp in data["write_plan"]:
            assert wp["mode"] == "create"
            assert wp["exists"] is False

    def test_with_readme_in_plan(self, empty_dir):
        r = run_setup(str(empty_dir), "--plan-json", "--with-readme")
        data = json.loads(r.stdout)
        filenames = [wp["filename"] for wp in data["write_plan"]]
        assert "README.md" in filenames


# ─────────────────────────────────────────────
# Golden output tests — content quality
# ─────────────────────────────────────────────

class TestGeneratedContent:
    """Verify generated files contain expected sections and markers."""

    def test_claude_md_has_required_sections(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        for section in [
            "## Repository Overview",
            "## Invariants",
            "## Decision Heuristics",
            "## Verification Standard",
            "## Red Flags",
            "## Stuck Protocol",
            "## Pre-Task Protocol",
            "### Post-Task",
            "## Key Decisions",
        ]:
            assert section in content, f"Missing section: {section}"

    def test_claude_md_has_frontmatter(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        assert content.startswith("---\n")
        assert "project:" in content
        assert "tier:" in content

    def test_claude_md_has_iron_law(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        assert "Iron Law" in content

    def test_claude_md_has_size_guidance(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        assert "300 lines" in content

    def test_standards_md_has_hard_gates(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "STANDARDS.md").read_text()
        assert "<HARD-GATE>" in content

    def test_standards_md_has_severity_levels(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "STANDARDS.md").read_text()
        assert "CRITICAL" in content
        assert "HIGH" in content
        assert "MEDIUM" in content

    def test_standards_md_has_core_principles(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "STANDARDS.md").read_text()
        assert "Core Principles" in content
        assert "Iron Law" in content

    def test_standards_md_has_iteration_limits(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "STANDARDS.md").read_text()
        assert "Max Iterations" in content

    def test_standards_md_has_legitimate_exceptions(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "STANDARDS.md").read_text()
        assert "Legitimate Exceptions" in content
        assert "Emergency hotfix" in content

    def test_errors_md_has_rationalization_table(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "ERRORS_AND_LESSONS.md").read_text()
        assert "Rationalization Table" in content
        assert "Too simple to test" in content

    def test_errors_md_has_defense_in_depth(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "ERRORS_AND_LESSONS.md").read_text()
        assert "Defense-in-Depth" in content

    def test_quickstart_has_workflow_example(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "QUICKSTART.md").read_text()
        assert "Complete Workflow Example" in content

    def test_python_project_has_stack_info(self, python_project):
        run_setup(str(python_project), "--yes", "--no-git-check")
        content = (python_project / "CLAUDE.md").read_text()
        assert "python" in content.lower() or "Python" in content

    def test_node_project_has_stack_info(self, node_project):
        run_setup(str(node_project), "--yes", "--no-git-check")
        content = (node_project / "CLAUDE.md").read_text()
        assert "node" in content.lower() or "Node" in content

    def test_provenance_markers_only_three_types(self, empty_dir):
        """All provenance markers should be one of: migrated, inferred, placeholder."""
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        import re
        valid_markers = {"migrated", "inferred", "placeholder"}
        for f in ["CLAUDE.md", "QUICKSTART.md", "STANDARDS.md", "ERRORS_AND_LESSONS.md"]:
            content = (empty_dir / f).read_text()
            markers = re.findall(r'<!-- \[([^\]]+)\] -->', content)
            for marker in markers:
                assert marker in valid_markers, (
                    f"Invalid provenance marker '{marker}' in {f}. "
                    f"Expected one of: {valid_markers}"
                )

    def test_no_empty_bash_blocks(self, empty_dir):
        """Generated files should not have empty ```bash``` blocks."""
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        import re
        for f in ["CLAUDE.md", "QUICKSTART.md"]:
            content = (empty_dir / f).read_text()
            # Find bash blocks with only comments or whitespace
            blocks = re.findall(r'```bash\n(.*?)```', content, re.DOTALL)
            for block in blocks:
                stripped = "\n".join(
                    line for line in block.strip().split("\n")
                    if line.strip() and not line.strip().startswith("#")
                )
                # It's ok to have comment-only blocks for placeholders,
                # but not completely empty blocks
                assert block.strip(), f"Empty bash block found in {f}"


class TestGitWorktreeSection:
    """Worktree guidance only appears in git repos."""

    def test_git_repo_has_parallel_dev(self, git_repo):
        run_setup(str(git_repo), "--yes", "--no-git-check")
        content = (git_repo / "CLAUDE.md").read_text()
        assert "Parallel Development" in content

    def test_non_git_no_parallel_dev(self, empty_dir):
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        content = (empty_dir / "CLAUDE.md").read_text()
        assert "Parallel Development" not in content


# ─────────────────────────────────────────────
# Edge cases
# ─────────────────────────────────────────────

class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_target_with_spaces(self, tmp_path):
        d = tmp_path / "my project dir"
        d.mkdir()
        r = run_setup(str(d), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert (d / "CLAUDE.md").exists()

    def test_nested_path(self, tmp_path):
        d = tmp_path / "a" / "b" / "c"
        r = run_setup(str(d), "--yes", "--no-git-check")
        assert r.returncode == 0
        assert d.exists()
        assert (d / "CLAUDE.md").exists()

    def test_existing_docs_detected(self, empty_dir):
        """Existing docs should show up in plan-json."""
        (empty_dir / "CLAUDE.md").write_text("# existing\n")
        r = run_setup(str(empty_dir), "--plan-json")
        data = json.loads(r.stdout)
        assert "CLAUDE.md" in data["existing_docs"]

    def test_idempotent_with_force(self, empty_dir):
        """Running with --force twice on existing files should produce same content."""
        # First run creates files
        run_setup(str(empty_dir), "--yes", "--no-git-check")
        # Second run with --force: extracts from existing files
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--force")
        content1 = (empty_dir / "CLAUDE.md").read_text()
        # Third run with --force: should produce same as second (stable extraction)
        run_setup(str(empty_dir), "--yes", "--no-git-check", "--force")
        content2 = (empty_dir / "CLAUDE.md").read_text()
        assert content1 == content2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
