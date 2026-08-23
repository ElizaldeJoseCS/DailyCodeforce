#!/usr/bin/env python3
"""Lightweight C++ judge. Compiles and runs source against test cases."""
import json, os, subprocess, sys, tempfile, shutil, resource

SANITIZED_ENV = {
    "PATH": "/usr/bin:/bin",
    "HOME": "/work",
    "LANG": "C.UTF-8",
}

MEMORY_LIMIT_MB = 256
MAX_PROCESSES = 64
MAX_FILE_SIZE = 10 * 1024 * 1024
RUN_TIMEOUT = 3
COMPILE_TIMEOUT = 10


def judge(source_path, test_cases):
    tmpdir = tempfile.mkdtemp(dir="/work")
    try:
        binary = os.path.join(tmpdir, "solution")
        comp = subprocess.run(
            ["g++", "-O2", "-std=c++17", "-o", binary, source_path],
            capture_output=True, text=True, timeout=COMPILE_TIMEOUT,
            env=SANITIZED_ENV,
        )
        if comp.returncode != 0:
            return {"verdict": "Compilation Error", "compileOutput": comp.stderr[:2000], "passed": 0, "failed": len(test_cases), "total": len(test_cases), "results": []}

        results = []
        passed = 0
        for i, tc in enumerate(test_cases):
            input_file = os.path.join(tmpdir, "input.txt")
            with open(input_file, "w") as f:
                f.write(tc["input"])

            actual = ""
            try:
                def set_limits():
                    try:
                        resource.setrlimit(resource.RLIMIT_AS,
                            (MEMORY_LIMIT_MB * 1024 * 1024, MEMORY_LIMIT_MB * 1024 * 1024))
                        resource.setrlimit(resource.RLIMIT_CPU,
                            (RUN_TIMEOUT, RUN_TIMEOUT))
                        resource.setrlimit(resource.RLIMIT_NPROC,
                            (MAX_PROCESSES, MAX_PROCESSES))
                        resource.setrlimit(resource.RLIMIT_FSIZE,
                            (MAX_FILE_SIZE, MAX_FILE_SIZE))
                    except (ValueError, resource.error):
                        pass

                proc = subprocess.run(
                    [binary],
                    stdin=open(input_file),
                    capture_output=True, text=True,
                    timeout=RUN_TIMEOUT,
                    env=SANITIZED_ENV,
                    preexec_fn=set_limits,
                    start_new_session=True,
                )
                actual = proc.stdout

                if proc.returncode != 0 and proc.returncode != -9:
                    verdict = "Runtime Error"
                elif proc.returncode == -9:
                    verdict = "Time Limit Exceeded"
                elif actual.strip() == tc["output"].strip():
                    verdict = "Accepted"
                    passed += 1
                else:
                    verdict = "Wrong Answer"
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(os.getpgid(proc.pid), 9)
                except Exception:
                    pass
                verdict = "Time Limit Exceeded"
                actual = ""
            except Exception:
                verdict = "Runtime Error"
                actual = ""

            results.append({
                "test": i + 1,
                "verdict": verdict,
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

    tmpsrc = sys.argv[1] + ".cpp"
    with open(tmpsrc, "w") as f:
        f.write(source)

    with open(sys.argv[2]) as f:
        test_cases = json.load(f)

    result = judge(tmpsrc, test_cases)
    print(json.dumps(result))
