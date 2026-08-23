#!/bin/bash
# Usage: ./run.sh <source_file> <test_cases_json>
# Input: C++ source file, JSON array of {input, output} objects
# Output: JSON with verdict and per-test results

set -e

SOURCE_FILE="$1"
TEST_CASES="$2"

if [ -z "$SOURCE_FILE" ] || [ -z "$TEST_CASES" ]; then
  echo '{"error":"Usage: run.sh <source_file> <test_cases_json>"}'
  exit 1
fi

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Compile
g++ -O2 -std=c++17 -o "$TMPDIR/solution" "$SOURCE_FILE" 2>"$TMPDIR/compile_err.txt"
if [ $? -ne 0 ]; then
  cat "$TMPDIR/compile_err.txt" | head -c 2000 | python3 -c "import sys,json; print(json.dumps({'verdict':'Compilation Error','compileOutput':sys.stdin.read()}))"
  exit 0
fi

# Run each test case
TEST_COUNT=$(echo "$TEST_CASES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
PASS=0
FAIL=0
RESULTS="[]"

for i in $(seq 0 $((TEST_COUNT - 1))); do
  INPUT=$(echo "$TEST_CASES" | python3 -c "import sys,json; print(json.load(sys.stdin)[$i]['input'])")
  EXPECTED=$(echo "$TEST_CASES" | python3 -c "import sys,json; print(json.load(sys.stdin)[$i]['output'])")

  echo "$INPUT" > "$TMPDIR/input.txt"

  ulimit -v 256000 -t 3 2>/dev/null
  timeout 3 "$TMPDIR/solution" < "$TMPDIR/input.txt" > "$TMPDIR/output.txt" 2>/dev/null
  EXIT_CODE=$?
  ulimit -v unlimited -t unlimited 2>/dev/null

  ACTUAL=$(cat "$TMPDIR/output.txt" 2>/dev/null | sed 's/[[:space:]]*$//' | sed 's/^\xEF\xBB\xBF//')
  EXPECTED_CLEAN=$(echo "$EXPECTED" | sed 's/[[:space:]]*$//' | sed 's/^\xEF\xBB\xBF//')

  if [ $EXIT_CODE -eq 124 ]; then
    VERDICT="Time Limit Exceeded"
    FAIL=$((FAIL + 1))
  elif [ $EXIT_CODE -ne 0 ]; then
    VERDICT="Runtime Error"
    FAIL=$((FAIL + 1))
  elif [ "$ACTUAL" = "$EXPECTED_CLEAN" ]; then
    VERDICT="Accepted"
    PASS=$((PASS + 1))
  else
    VERDICT="Wrong Answer"
    FAIL=$((FAIL + 1))
  fi

  RESULTS=$(echo "$RESULTS" | python3 -c "
import sys,json
r = json.load(sys.stdin)
r.append({'test':$((i+1)),'verdict':'$VERDICT','input':'''$(echo "$INPUT" | head -c 200)''','expected':'''$(echo "$EXPECTED" | head -c 200)''','actual':'''$(echo "$ACTUAL" | head -c 200)'''})
print(json.dumps(r))
")
done

if [ $FAIL -eq 0 ]; then
  FINAL="Accepted"
else
  FINAL="Wrong Answer"
fi

echo "{\"verdict\":\"$FINAL\",\"passed\":$PASS,\"failed\":$FAIL,\"total\":$TEST_COUNT,\"results\":$RESULTS}"
