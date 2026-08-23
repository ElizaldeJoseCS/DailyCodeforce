#!/usr/bin/env python3
"""Secure HTTP judge server. Accepts code + test cases, returns verdicts."""
import json, os, subprocess, sys, tempfile, shutil, resource
from http.server import HTTPServer, BaseHTTPRequestHandler

MAX_SOURCE_BYTES = 50_000
MAX_TESTS = 20
MAX_INPUT_PER_TEST = 10_000
COMPILE_TIMEOUT = 10
RUN_TIMEOUT = 3
MEMORY_LIMIT_MB = 256
MAX_PROCESSES = 64
MAX_FILE_SIZE = 10 * 1024 * 1024

SANITIZED_ENV = {
    "PATH": "/usr/bin:/bin",
    "HOME": "/tmp",
    "LANG": "C.UTF-8",
}


def judge(source_code, test_cases):
    tmpdir = tempfile.mkdtemp()
    try:
        src_path = os.path.join(tmpdir, "solution.cpp")
        with open(src_path, "w") as f:
            f.write(source_code)

        binary = os.path.join(tmpdir, "solution")

        comp = subprocess.run(
            ["g++", "-O2", "-std=c++17", "-o", binary, src_path],
            capture_output=True, text=True, timeout=COMPILE_TIMEOUT,
            env=SANITIZED_ENV,
        )
        if comp.returncode != 0:
            return {
                "verdict": "Compilation Error",
                "compileOutput": comp.stderr[:2000],
                "passed": 0,
                "failed": len(test_cases),
                "total": len(test_cases),
                "results": [],
            }

        results = []
        passed = 0

        for i, tc in enumerate(test_cases):
            input_file = os.path.join(tmpdir, f"input_{i}.txt")
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
        return {
            "verdict": final,
            "passed": passed,
            "failed": len(test_cases) - passed,
            "total": len(test_cases),
            "results": results,
        }
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def judge_internal(source_code, test_cases):
    """Full judge for internal use (editorial validation). Returns input/output."""
    tmpdir = tempfile.mkdtemp()
    try:
        src_path = os.path.join(tmpdir, "solution.cpp")
        with open(src_path, "w") as f:
            f.write(source_code)

        binary = os.path.join(tmpdir, "solution")

        comp = subprocess.run(
            ["g++", "-O2", "-std=c++17", "-o", binary, src_path],
            capture_output=True, text=True, timeout=COMPILE_TIMEOUT,
            env=SANITIZED_ENV,
        )
        if comp.returncode != 0:
            return {
                "verdict": "Compilation Error",
                "compileOutput": comp.stderr[:2000],
                "passed": 0,
                "failed": len(test_cases),
                "total": len(test_cases),
                "results": [],
            }

        results = []
        passed = 0

        for i, tc in enumerate(test_cases):
            input_file = os.path.join(tmpdir, f"input_{i}.txt")
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
                "input": tc["input"][:500],
                "expected": tc["output"][:500],
                "actual": actual[:500],
            })

        final = "Accepted" if passed == len(test_cases) else "Wrong Answer"
        return {
            "verdict": final,
            "passed": passed,
            "failed": len(test_cases) - passed,
            "total": len(test_cases),
            "results": results,
        }
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


class JudgeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_POST(self):
        if self.path == "/judge":
            self._handle_judge(internal=False)
        elif self.path == "/judge/internal":
            self._handle_judge(internal=True)
        else:
            self._respond(404, {"error": "Not found"})

    def _handle_judge(self, internal=False):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 2 * 1024 * 1024:
                self._respond(413, {"error": "Request too large"})
                return

            body = self.rfile.read(length)
            data = json.loads(body)

            source_code = data.get("sourceCode", "")
            test_cases = data.get("testCases", [])

            if not source_code:
                self._respond(400, {"error": "sourceCode required"})
                return

            if len(source_code) > MAX_SOURCE_BYTES:
                self._respond(400, {"error": "Source code too large (max 50KB)"})
                return

            if not test_cases or not isinstance(test_cases, list):
                self._respond(400, {"error": "testCases required"})
                return

            if len(test_cases) > MAX_TESTS:
                test_cases = test_cases[:MAX_TESTS]

            for tc in test_cases:
                if not isinstance(tc, dict) or "input" not in tc or "output" not in tc:
                    self._respond(400, {"error": "Each test case needs input and output"})
                    return

            judge_fn = judge_internal if internal else judge
            result = judge_fn(source_code, test_cases)
            self._respond(200, result)

        except json.JSONDecodeError:
            self._respond(400, {"error": "Invalid JSON"})
        except Exception as e:
            self._respond(500, {"error": "Internal error"})

    def _respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(json.dumps(data))))
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


if __name__ == "__main__":
    port = int(os.environ.get("JUDGE_PORT", "8080"))
    server = HTTPServer(("0.0.0.0", port), JudgeHandler)
    print(f"Judge server running on port {port}", flush=True)
    server.serve_forever()
