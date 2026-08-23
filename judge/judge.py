#!/usr/bin/env python3
"""Lightweight C++ judge. Compiles and runs source against test cases."""
import json, os, subprocess, sys, tempfile, shutil

def judge(source_path, test_cases):
    tmpdir = tempfile.mkdtemp()
    try:
        binary = os.path.join(tmpdir, "solution")
        comp = subprocess.run(
            ["g++", "-O2", "-std=c++17", "-o", binary, source_path],
            capture_output=True, text=True, timeout=10
        )
        if comp.returncode != 0:
            return {"verdict": "Compilation Error", "compileOutput": comp.stderr[:2000], "passed": 0, "failed": len(test_cases), "total": len(test_cases), "results": []}

        results = []
        passed = 0
        for i, tc in enumerate(test_cases):
            input_file = os.path.join(tmpdir, "input.txt")
            with open(input_file, "w") as f:
                f.write(tc["input"])

            try:
                proc = subprocess.run(
                    [binary],
                    stdin=open(input_file),
                    capture_output=True, text=True,
                    timeout=2, env={**os.environ, "MALLOC_ARENA_MAX": "1"}
                )
                actual = proc.stdout.strip()
                expected = tc["output"].strip()

                if proc.returncode != 0 and proc.returncode != -9:
                    verdict = "Runtime Error"
                elif proc.returncode == -9:
                    verdict = "Time Limit Exceeded"
                elif actual == expected:
                    verdict = "Accepted"
                    passed += 1
                else:
                    verdict = "Wrong Answer"
            except subprocess.TimeoutExpired:
                verdict = "Time Limit Exceeded"
            except Exception:
                verdict = "Runtime Error"

            results.append({
                "test": i + 1,
                "verdict": verdict,
                "input": tc["input"][:200],
                "expected": tc["output"][:200],
                "actual": (actual[:200] if 'actual' in dir() else ""),
            })

        final = "Accepted" if passed == len(test_cases) else "Wrong Answer"
        return {"verdict": final, "passed": passed, "failed": len(test_cases) - passed, "total": len(test_cases), "results": results}
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: judge.py <source.cpp> <test_cases.json>"}))
        sys.exit(1)

    with open(sys.argv[1]) as f:
        source = f.read()

    # Write source to temp file
    tmpsrc = sys.argv[1] + ".cpp"
    with open(tmpsrc, "w") as f:
        f.write(source)

    with open(sys.argv[2]) as f:
        test_cases = json.load(f)

    result = judge(tmpsrc, test_cases)
    print(json.dumps(result))
