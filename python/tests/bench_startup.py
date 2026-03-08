"""Benchmark claude-primer startup and generation time."""
import subprocess
import sys
import time
import tempfile
import json
import os


def bench(label, cmd, runs=5):
    times = []
    for _ in range(runs):
        t0 = time.perf_counter()
        subprocess.run(cmd, capture_output=True)
        times.append(time.perf_counter() - t0)
    avg = sum(times) / len(times)
    best = min(times)
    worst = max(times)
    print(f"  {label:30s}  avg={avg:.3f}s  best={best:.3f}s  worst={worst:.3f}s  (n={runs})")
    return {"label": label, "avg": avg, "best": best, "worst": worst, "runs": runs}


def main():
    print("claude-primer benchmarks")
    print("=" * 60)

    import pathlib
    script = str(pathlib.Path(__file__).parent.parent / "claude_primer.py")
    cp = [sys.executable, script]

    # 1. --help startup time
    bench("--help", [*cp, "--help"])

    # 2. --plan-json on a small project
    with tempfile.TemporaryDirectory() as tmp:
        pkg = os.path.join(tmp, "package.json")
        with open(pkg, "w") as f:
            json.dump({"name": "bench", "dependencies": {"express": "^4.0"}}, f)
        with open(os.path.join(tmp, "index.js"), "w") as f:
            f.write("console.log('hello');\n")

        bench("--plan-json (small)", [*cp, tmp, "--plan-json", "--no-git-check"])

        # 3. Full generation
        bench("full generation (small)", [*cp, tmp, "--yes", "--no-git-check", "--force"])

        # 4. --diff on existing
        bench("--diff (no changes)", [*cp, tmp, "--diff", "--no-git-check"])

        # 5. --check on existing
        bench("--check (up-to-date)", [*cp, tmp, "--check", "--no-git-check"])

    # 6. Medium project
    with tempfile.TemporaryDirectory() as tmp:
        pkg = os.path.join(tmp, "package.json")
        with open(pkg, "w") as f:
            json.dump({
                "name": "medium-project",
                "dependencies": {
                    "express": "^4.0", "react": "^18.0", "typescript": "^5.0",
                    "jest": "^29.0", "eslint": "^8.0", "prettier": "^3.0",
                },
                "scripts": {"test": "jest", "build": "tsc", "lint": "eslint ."},
            }, f)
        # Create some source files
        os.makedirs(os.path.join(tmp, "src"), exist_ok=True)
        for i in range(10):
            with open(os.path.join(tmp, "src", f"module{i}.ts"), "w") as f:
                f.write(f"export function fn{i}() {{ return {i}; }}\n")
        with open(os.path.join(tmp, "tsconfig.json"), "w") as f:
            json.dump({"compilerOptions": {"target": "es2020", "module": "commonjs"}}, f)
        with open(os.path.join(tmp, ".eslintrc.json"), "w") as f:
            json.dump({"extends": ["eslint:recommended"]}, f)

        bench("full generation (medium)", [*cp, tmp, "--yes", "--no-git-check"])
        bench("--force (medium, skip)", [*cp, tmp, "--yes", "--no-git-check", "--force"])

    print()
    print("Done.")


if __name__ == "__main__":
    main()
