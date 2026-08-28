import Anthropic from "@anthropic-ai/sdk";
import { ProblemStatement } from "./codeforces";

const GEMINI_MODEL = "gemini-3.6-flash";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const CLAUDE_DISABLED = process.env.CLAUDE_DISABLED === "1";

let _geminiKey: string | undefined;
function getGeminiKey(): string {
  if (_geminiKey === undefined) {
    _geminiKey = process.env.GEMINI_API_KEY || "";
  }
  return _geminiKey;
}

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

interface LLMResponse {
  text: string;
  provider: string;
}

async function callGemini(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
  retries = 3
): Promise<string> {
  if (!getGeminiKey()) {
    throw new Error("No GEMINI_API_KEY configured");
  }
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getGeminiKey()}`,
        },
        body: JSON.stringify({
          model: GEMINI_MODEL,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      }
    );
    if (res.status === 429) {
      const wait = attempt * 30;
      console.warn(`  Gemini rate limited, waiting ${wait}s (attempt ${attempt}/${retries})...`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      lastError = new Error(`Gemini 429: rate limited`);
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    if (text.length === 0) {
      throw new Error("Gemini returned empty response");
    }
    return text;
  }
  throw lastError || new Error("Gemini failed after retries");
}

async function callHaiku(
  systemPrompt: string,
  userContent: string,
  maxTokens: number
): Promise<string> {
  if (CLAUDE_DISABLED) {
    throw new Error("Claude API is disabled");
  }
  const response = await getAnthropic().messages.create({
    model: HAIKU_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });
  for (const block of response.content) {
    if ("text" in block && block.type === "text") {
      return block.text;
    }
  }
  return "";
}

async function callLLM(
  systemPrompt: string,
  userContent: string,
  maxTokens: number
): Promise<LLMResponse> {
  // Always try Gemini first (free)
  if (getGeminiKey()) {
    try {
      const text = await callGemini(systemPrompt, userContent, maxTokens);
      return { text, provider: "gemini" };
    } catch (err) {
      console.error(`Gemini failed: ${err}`);
    }
  }

  // Last resort: Haiku (costs money — log it)
  console.warn(`⚠️ Falling back to Haiku (Claude API) — this costs money!`);
  try {
    const text = await callHaiku(systemPrompt, userContent, maxTokens);
    return { text, provider: "haiku" };
  } catch (err) {
    console.error(`Haiku also failed: ${err}`);
    return { text: "", provider: "none" };
  }
}

// Gemini-only call: no Claude fallback. Used for non-critical tasks like test case generation.
async function callGeminiOnly(
  systemPrompt: string,
  userContent: string,
  maxTokens: number
): Promise<LLMResponse> {
  if (!getGeminiKey()) {
    console.error("No GEMINI_API_KEY configured, skipping");
    return { text: "", provider: "none" };
  }
  try {
    const text = await callGemini(systemPrompt, userContent, maxTokens);
    return { text, provider: "gemini" };
  } catch (err) {
    console.error(`Gemini failed (no fallback): ${err}`);
    return { text: "", provider: "none" };
  }
}

const JUDGE_URL = process.env.JUDGE_URL || "http://judge:8080";

const SYSTEM_PROMPT = `You are a world-class competitive programming tutor writing LeetCode-style editorials for Codeforces problems. Your solutions must be CORRECT and COMPLETE — they will be automatically tested against test cases. Write clear, educational explanations with working C++ code. Format in markdown with ## for sections, fenced code blocks for C++ solutions.`;

const ALGO_HINTS: Record<string, string> = {
  "implementation": "Carefully handle all edge cases. Read the problem statement literally — implement exactly what's asked.",
  "greedy": "Prove greedy correctness: show that making the locally optimal choice leads to a globally optimal solution. Consider sorting by a key.",
  "dp": "Define state clearly: what does dp[i] (or dp[i][j]) represent? Write the recurrence, then identify base cases. Consider bottom-up tabulation over recursion.",
  "graphs": "Choose the right representation: adjacency list for sparse, matrix for dense. BFS for shortest path in unweighted, Dijkstra for weighted. Watch for cycles.",
  "binary search": "Binary search on the answer: define a predicate can(x) that checks if a given value works. The answer is the boundary where the predicate flips.",
  "two pointers": "Sort first if needed. Maintain two pointers that only move forward. Think about what invariant the pointers maintain.",
  "prefix sums": "Build prefix sum array: pref[i] = sum of first i elements. Range sum [l,r] = pref[r] - pref[l-1]. For 2D: pref[i][j] = sum of submatrix (0,0) to (i,j).",
  "sliding window": "Maintain a window [l,r] with a valid invariant. Expand r, shrink l when invalid. Use a frequency map or counter to track window contents.",
  "math": "Look for patterns, modular arithmetic, GCD/LCM, combinatorics. Prove formulas with small cases first. Watch for division by zero and integer overflow.",
  "number theory": "Sieve for primes, factorization. GCD via Euclidean algorithm. Modular inverse via Fermat's little theorem or extended Euclidean.",
  "strings": "KMP/Z-function for pattern matching. Trie for prefix queries. Rolling hash for substring comparison. Handle 0-indexed vs 1-indexed carefully.",
  "data structures": "Choose the right structure: set/map for ordered, unordered_map for O(1) average, Fenwick/segment tree for range queries, union-find for connectivity.",
  "bitmasks": "Iterate over all subsets: for(int mask=0; mask<(1<<n); mask++). Check/set/clear bit i: (mask>>i)&1, mask|(1<<i), mask&~(1<<i).",
  "constructive algorithms": "Think backwards from the desired output. Build the answer incrementally. Try small cases to find a pattern.",
  "sortings": "Sort by a custom comparator. For intervals: sort by end point (activity selection). For greedy: sort by the key that the greedy choice depends on.",
  "combinatorics": "Count systematically. Use inclusion-exclusion for 'at least' problems. Pascal's triangle for binomial coefficients. Consider modular arithmetic.",
  "geometry": "Use long long to avoid precision issues. Cross product for orientation, dot product for angles. Convex hull: sort by angle, maintain stack.",
  "interactive": "Flush output after each query: cout << endl or cout.flush(). Binary search is common. Read the judge's response after each output.",
  "divide and conquer": "Split problem into subproblems, solve recursively, combine results. Master theorem for complexity. Consider where to split.",
  "trees": "Root the tree arbitrarily. DFS for subtree queries, BFS for level-order. Parent/children representation. LCA with binary lifting for ancestor queries.",
  "shortest paths": "BFS for unweighted graphs. Dijkstra (priority queue) for non-negative weights. Bellman-Ford for negative weights. Floyd-Warshall for all-pairs.",
  "brute force": "Try all possibilities. Optimize with pruning: skip branches that can't improve the answer. For n≤20, try all subsets (bitmask).",
};

const TEST_CASE_PROMPT = `You are a competitive programming test case generator. Given a problem statement, generate additional test cases to validate solutions.

Rules:
- Generate exactly 5 test cases covering edge cases and boundary conditions
- Each test case must be a valid input that follows the problem's input format
- Include edge cases: minimum values, maximum values, single elements, empty cases if applicable
- Include cases that might trip up common wrong approaches
- Output ONLY valid JSON array, no explanation

Output format (strict JSON):
[{"input": "...", "output": "..."}]

The output for each test case must be the EXACT correct answer. Think carefully about each answer before outputting.`;

const VERIFY_ANSWER_PROMPT = `You are a meticulous competitive programmer double-checking a test case for a Codeforces problem. You will be given the problem statement and one specific input. Work through the problem carefully, step by step, and then output ONLY the exact correct output for that input — matching the required output format precisely. No explanation, no extra text.`;

function buildUserPrompt(
  problemName: string,
  tags: string[],
  rating: number,
  contestId: number,
  index: string,
  statement?: ProblemStatement | null,
  feedback?: string
): string {
  const tagStr = tags.join(", ");

  // Find relevant algorithmic hints based on tags
  const hints: string[] = [];
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const [key, hint] of Object.entries(ALGO_HINTS)) {
      if (lower.includes(key) || key.includes(lower)) {
        hints.push(hint);
      }
    }
  }

  let problemContext = `**Problem:** ${problemName} (Contest ${contestId}, Problem ${index})
**Difficulty:** ${rating}
**Tags:** ${tagStr}`;

  if (hints.length > 0) {
    problemContext += `\n\n**Algorithmic hints:**\n${hints.map(h => `- ${h}`).join("\n")}`;
  }

  if (statement) {
    problemContext += `

## Full Problem Statement

${statement.statement}

**Input:** ${statement.inputSpec}

**Output:** ${statement.outputSpec}

**Time Limit:** ${statement.timeLimit}
**Memory Limit:** ${statement.memoryLimit}

**Examples:**
${statement.examples.map((ex, i) => `Example ${i + 1}:
Input:
${ex.input}
Output:
${ex.output}`).join("\n\n")}`;

    if (statement.note) {
      problemContext += `\n\n**Note:** ${statement.note}`;
    }
  }

  let prompt = `Write an editorial for this Codeforces problem. Your solution WILL BE automatically tested against test cases — it must be completely correct.

${problemContext}

Structure your editorial as:
## Intuition
Brief explanation of the key insight. Why does this approach work?

## Approach
Step-by-step algorithm description. Be precise about the logic.

## Complexity
- Time: O(...)
- Space: O(...)

## Solution (C++)
Write a COMPLETE, TESTED C++ solution:

\`\`\`cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Complete working solution here

    return 0;
}
\`\`\`

### Critical rules for the solution code:
1. **Add comments to the code** - briefly explain what each key section does. Use single-line // comments for non-obvious logic, and use // --- Section Name --- block comments to separate major steps.
2. **Input parsing must be exact** — read every value exactly as the problem specifies. Pay special attention to:
   - Multi-test-case format: first line is t, then t test cases
   - Whether input ends at EOF or has a fixed number of lines
   - Space-separated vs line-separated values
   - Whether n is given on its own line or alongside other values
2. **Use appropriate data types** — use \`long long\` when values can exceed 2×10^9. Use \`int\` only when you're sure values fit (≤ 2×10^9).
3. **Handle edge cases explicitly**:
   - n = 0 or n = 1
   - All elements equal
   - Negative numbers (if allowed)
   - Maximum constraints
   - Single test case vs multiple test cases
4. **Output format must match exactly** — no extra spaces, newlines, or text. Match the example output format precisely.
5. **Do NOT use \`#define int long long\`** — it causes issues with some judge configurations. Instead, explicitly use \`long long\` where needed.
6. **Algorithm correctness over cleverness** — write clear, correct code. A slightly longer but correct solution is better than a short but buggy one.

Keep explanations clear and educational. Assume the reader knows basic data structures but may not know the specific technique needed.`;

  if (feedback) {
    prompt += `

**IMPORTANT: Your previous solution FAILED validation. Here is the detailed feedback:**

${feedback}

Analyze the error carefully. Common causes:
- Wrong algorithm or missing an edge case
- Integer overflow (use long long)
- Off-by-one errors in loops
- Incorrect input parsing
- Wrong output format

Provide a COMPLETE corrected editorial with a solution that fixes ALL the listed errors. Output the full editorial again with the corrected solution.`;
  }

  return prompt;
}

function buildTestCasePrompt(
  problemName: string,
  statement: ProblemStatement
): string {
  return `Generate 5 additional test cases for this problem:

**Problem:** ${problemName}

**Statement:** ${statement.statement}

**Input format:** ${statement.inputSpec}

**Output format:** ${statement.outputSpec}

**Examples:**
${statement.examples.map((ex, i) => `Example ${i + 1}:
Input:
${ex.input}
Output:
${ex.output}`).join("\n\n")}

${statement.note ? `**Note:** ${statement.note}` : ""}

Generate 5 edge-case test cases. Output ONLY the JSON array.`;
}

export function extractCppCode(markdown: string): string | null {
  // Try various C++ code block formats
  const patterns = [
    /```cpp\n([\s\S]*?)```/,
    /```c\+\+\n([\s\S]*?)```/,
    /```C\+\+\n([\s\S]*?)```/,
    /```cpp([\s\S]*?)```/,
    /```c\+\+([\s\S]*?)```/,
  ];
  for (const re of patterns) {
    const match = markdown.match(re);
    if (match) return match[1].trim();
  }
  // Fallback: find any code block containing #include
  const allBlocks = Array.from(markdown.matchAll(/```[\s\S]*?```/g));
  for (const block of allBlocks) {
    const inner = block[0].replace(/^```\w*\n?/, "").replace(/```$/, "").trim();
    if (inner.includes("#include")) return inner;
  }
  return null;
}

// Whitespace-insensitive, float-tolerant comparison — mirrors the judge's
// own outputs_match() so a candidate test case is only trusted when two
// independently-derived answers actually agree token-for-token.
function outputsRoughlyMatch(expected: string, actual: string): boolean {
  const expTokens = expected.trim().split(/\s+/).filter(Boolean);
  const actTokens = actual.trim().split(/\s+/).filter(Boolean);
  if (expTokens.length !== actTokens.length) return false;
  for (let i = 0; i < expTokens.length; i++) {
    if (expTokens[i] === actTokens[i]) continue;
    const ef = Number(expTokens[i]);
    const af = Number(actTokens[i]);
    if (Number.isNaN(ef) || Number.isNaN(af)) return false;
    if (Math.abs(ef - af) > Math.max(1e-6, 1e-6 * Math.abs(ef))) return false;
  }
  return true;
}

function buildVerifyPrompt(statement: ProblemStatement, input: string): string {
  return `**Statement:** ${statement.statement}

**Input format:** ${statement.inputSpec}
**Output format:** ${statement.outputSpec}
${statement.note ? `**Note:** ${statement.note}` : ""}

Compute the correct output for this exact input:

${input}

Output ONLY the correct output, nothing else.`;
}

// An LLM asked to invent test cases has no way to check its own guessed
// answers — a wrong guess silently poisons validation (a correct editorial
// solution can fail against a bogus "expected" output, or a wrong one can
// pass by matching the same bogus guess). Since there's no reference judge
// to check against, cross-verify each candidate with a second, independent
// generation and only keep cases where both derivations agree.
export async function generateExtraTestCases(
  problemName: string,
  statement: ProblemStatement
): Promise<{ input: string; output: string }[]> {
  try {
    const result = await callGeminiOnly(
      TEST_CASE_PROMPT,
      buildTestCasePrompt(problemName, statement),
      4000
    );
    console.log(`  [${result.provider}] test cases response: ${result.text.length} chars`);

    const content = result.text;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const candidates = (JSON.parse(jsonMatch[0]) as { input: string; output: string }[]).filter(
      (tc) =>
        typeof tc.input === "string" &&
        typeof tc.output === "string" &&
        tc.input.length > 0 &&
        tc.output.length > 0
    );

    const verified: { input: string; output: string }[] = [];
    for (const tc of candidates) {
      const check = await callGeminiOnly(
        VERIFY_ANSWER_PROMPT,
        buildVerifyPrompt(statement, tc.input),
        1000
      );
      if (check.text && outputsRoughlyMatch(tc.output, check.text)) {
        verified.push(tc);
      } else {
        console.log(`  ⚠️  discarding unverified test case (answers disagreed): input=${tc.input.slice(0, 60).replace(/\n/g, "\\n")}...`);
      }
    }

    return verified;
  } catch {
    return [];
  }
}

// Parses CF-scraped limit strings like "2 seconds" / "256 megabytes" so the
// judge can be told the problem's actual constraints instead of using its
// fixed defaults for every problem.
export function parseTimeLimitSeconds(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/([\d.]+)\s*second/i);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v : undefined;
}

export function parseMemoryLimitMb(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/([\d.]+)\s*megabyte/i);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v : undefined;
}

export async function validateSolution(
  sourceCode: string,
  testCases: { input: string; output: string }[],
  limits?: { timeLimitSeconds?: number; memoryLimitMb?: number }
): Promise<{ passed: boolean; details: string }> {
  try {
    const res = await fetch(`${JUDGE_URL}/judge/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceCode,
        testCases,
        timeLimitSeconds: limits?.timeLimitSeconds,
        memoryLimitMb: limits?.memoryLimitMb,
      }),
    });

    if (!res.ok) {
      return { passed: false, details: "Judge service unavailable" };
    }

    const result = await res.json();

    if (result.verdict === "Compilation Error") {
      return { passed: false, details: `Compilation Error:\n${result.compileOutput || "Unknown"}` };
    }

    if (result.passed === result.total) {
      return { passed: true, details: "All tests passed" };
    }

    const failedTests = (result.results || [])
      .filter((r: { verdict: string }) => r.verdict !== "Accepted")
      .map((r: { test: number; verdict: string; input?: string; expected?: string; actual?: string }) => {
        return `Test ${r.test} (${r.verdict}):\nInput:\n${r.input || "?"}\nExpected:\n${r.expected || "?"}\nGot:\n${r.actual || "?"}`;
      });

    return {
      passed: false,
      details: `${result.passed}/${result.total} tests passed.\n\n${failedTests.join("\n\n")}`,
    };
  } catch (err) {
    return { passed: false, details: `Judge error: ${err}` };
  }
}

const MAX_RETRIES = 3;

export async function generateValidatedEditorial(
  problemName: string,
  tags: string[],
  rating: number,
  contestId: number,
  index: string,
  statement?: ProblemStatement | null,
  testCases?: { input: string; output: string }[]
): Promise<{ editorial: string; validated: boolean }> {
  // Generate extra validation test cases (only if CF test cases are sparse)
  let extraTestCases: { input: string; output: string }[] = [];
  const cfTestCount = testCases?.length || 0;
  if (statement && statement.examples.length > 0 && cfTestCount < 3) {
    extraTestCases = await generateExtraTestCases(problemName, statement);
  }

  // Combine CF samples + AI-generated edge cases for validation
  const allTestCases = [
    ...(testCases || []),
    ...extraTestCases,
  ];

  // Deduplicate by input
  const seen = new Set<string>();
  const validationTestCases = allTestCases.filter((tc) => {
    const key = tc.input.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const limits = {
    timeLimitSeconds: parseTimeLimitSeconds(statement?.timeLimit),
    memoryLimitMb: parseMemoryLimitMb(statement?.memoryLimit),
  };

  let editorial = "";
  let validated = false;
  let lastFeedback: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Build a fresh prompt each retry instead of accumulating history
    const userContent = buildUserPrompt(
      problemName, tags, rating, contestId, index, statement, lastFeedback
    );

    // First attempt uses callLLM (Gemini → Haiku fallback).
    // Retries use Gemini only (free) to avoid burning credits.
    const result = attempt === 1
      ? await callLLM(SYSTEM_PROMPT, userContent, 16384)
      : await callGeminiOnly(SYSTEM_PROMPT, userContent, 16384);
    console.log(`  [${result.provider}] editorial attempt ${attempt}: ${result.text.length} chars`);

    editorial = result.text;

    if (validationTestCases.length === 0) {
      // No ground truth to check against — editorial is unvalidated, not failed.
      break;
    }

    const cppCode = extractCppCode(editorial);
    if (!cppCode) {
      break;
    }

    const validation = await validateSolution(cppCode, validationTestCases, limits);

    if (validation.passed) {
      validated = true;
      break;
    }

    if (attempt < MAX_RETRIES) {
      lastFeedback = `Your solution failed on attempt ${attempt}. Here are the details:\n\n${validation.details}\n\nPlease provide a COMPLETE corrected solution that passes ALL test cases. Fix the algorithmic error and output the full editorial again.`;
    }
  }

  return { editorial, validated };
}

export async function generateEditorial(
  problemName: string,
  tags: string[],
  rating: number,
  contestId: number,
  index: string,
  statement?: ProblemStatement | null
): Promise<string> {
  const { editorial } = await generateValidatedEditorial(
    problemName, tags, rating, contestId, index, statement
  );
  return editorial;
}
