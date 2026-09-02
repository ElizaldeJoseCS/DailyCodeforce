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
  truncated: boolean;
}

interface RawLLMResult {
  text: string;
  truncated: boolean;
}

async function callGemini(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
  retries = 3
): Promise<RawLLMResult> {
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
    return { text, truncated: data.choices?.[0]?.finish_reason === "length" };
  }
  throw lastError || new Error("Gemini failed after retries");
}

async function callHaiku(
  systemPrompt: string,
  userContent: string,
  maxTokens: number
): Promise<RawLLMResult> {
  if (CLAUDE_DISABLED) {
    throw new Error("Claude API is disabled");
  }
  const response = await getAnthropic().messages.create({
    model: HAIKU_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });
  const truncated = response.stop_reason === "max_tokens";
  for (const block of response.content) {
    if ("text" in block && block.type === "text") {
      return { text: block.text, truncated };
    }
  }
  return { text: "", truncated };
}

async function callLLM(
  systemPrompt: string,
  userContent: string,
  maxTokens: number
): Promise<LLMResponse> {
  // Always try Gemini first (free)
  if (getGeminiKey()) {
    try {
      const { text, truncated } = await callGemini(systemPrompt, userContent, maxTokens);
      return { text, truncated, provider: "gemini" };
    } catch (err) {
      console.error(`Gemini failed: ${err}`);
    }
  }

  // Last resort: Haiku (costs money — log it)
  console.warn(`⚠️ Falling back to Haiku (Claude API) — this costs money!`);
  try {
    const { text, truncated } = await callHaiku(systemPrompt, userContent, maxTokens);
    return { text, truncated, provider: "haiku" };
  } catch (err) {
    console.error(`Haiku also failed: ${err}`);
    return { text: "", truncated: false, provider: "none" };
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
    return { text: "", truncated: false, provider: "none" };
  }
  try {
    const { text, truncated } = await callGemini(systemPrompt, userContent, maxTokens);
    return { text, truncated, provider: "gemini" };
  } catch (err) {
    console.error(`Gemini failed (no fallback): ${err}`);
    return { text: "", truncated: false, provider: "none" };
  }
}

// Forces Haiku specifically (bypassing Gemini) — used for the final retry so a
// systematic Gemini failure on a given problem doesn't just repeat itself.
// Falls back to Gemini if Claude is disabled/unavailable, rather than giving up.
async function callHaikuOnly(
  systemPrompt: string,
  userContent: string,
  maxTokens: number
): Promise<LLMResponse> {
  if (!CLAUDE_DISABLED) {
    try {
      const { text, truncated } = await callHaiku(systemPrompt, userContent, maxTokens);
      return { text, truncated, provider: "haiku" };
    } catch (err) {
      console.error(`Haiku failed: ${err}`);
    }
  }
  return callGeminiOnly(systemPrompt, userContent, maxTokens);
}

const JUDGE_URL = process.env.JUDGE_URL || "http://judge:8080";

const SYSTEM_PROMPT = `You are a world-class competitive programming tutor writing LeetCode-style editorials for Codeforces problems. Your solutions must be CORRECT and COMPLETE — they will be automatically tested against test cases. Write clear, educational explanations with working C++ code. Format in markdown with ## for sections, fenced code blocks for C++ solutions.

Be concise. Every editorial MUST fit completely within your output budget — a response cut off before the closing \`\`\` of the code block is a hard failure. Keep prose tight: 2-4 short sentences per section is plenty. Do not pad with restating the problem statement. If you're running low on room, shorten the prose, never the code.

Put exactly ONE fenced C++ code block in the entire response, in the final "Solution" section. Do not include any other code blocks (no illustrative snippets, no partial examples) anywhere else in the editorial — they cause automated extraction to grab the wrong block.

NEVER use LaTeX math notation — no $ signs, no \\frac, \\le, \\ge, \\times, \\sum, \\dots, or subscript/superscript syntax like a_i or n^2. This site renders plain markdown only; LaTeX renders as literal dollar signs and backslashes, not math. Write all math in plain text/unicode instead: use <=, >=, *, ^, sqrt(), array-index notation like a[i] instead of a_i, and spell out complexity as O(n log n) with no delimiters at all.`;

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

const MAIN_FN_RE = /\b(int|signed|void)\s+main\s*\(/;

export function extractCppCode(markdown: string): string | null {
  // A model that includes a small illustrative snippet earlier (e.g. in the
  // Approach section) can have multiple ```cpp blocks — grab every closed
  // block and prefer the last one that's an actual runnable program (has a
  // main()), since the real solution lives in the final "Solution" section.
  // Falls back to the first block with #include, then the first block at all,
  // for tolerance of minor formatting slips (missing language tag, etc).
  const patterns = [
    /```(?:cpp|c\+\+|C\+\+)\n?([\s\S]*?)```/g,
    /```\w*\n?([\s\S]*?)```/g,
  ];

  for (const re of patterns) {
    const blocks = Array.from(markdown.matchAll(re)).map((m) => m[1].trim());
    if (blocks.length === 0) continue;

    const withMain = blocks.filter((b) => MAIN_FN_RE.test(b));
    if (withMain.length > 0) return withMain[withMain.length - 1];

    const withInclude = blocks.find((b) => b.includes("#include"));
    if (withInclude) return withInclude;

    if (re === patterns[0]) return blocks[blocks.length - 1];
  }

  return null;
}

const REQUIRED_SECTIONS = ["## Intuition", "## Approach", "## Complexity", "## Solution"];

// Matches raw LaTeX that renders as literal text on this site (no math
// renderer): $...$ inline math, or common LaTeX control sequences like
// \frac, \le, a_i subscripts, etc. Checked against prose only (code blocks
// stripped first) so legitimate uses of $ or \ inside C++ source don't trip it.
const LATEX_RE = /\$[^$\n]{1,120}\$|\\(?:frac|le|ge|leq|geq|times|dots|ldots|cdot|sum|sqrt|in|neq|pmod|binom|lfloor|rfloor|lceil|rceil)\b|[A-Za-z]_\{?[A-Za-z0-9]/;

function stripCodeBlocks(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, "");
}

// Cheap, objective checks that don't require running anything: did the model
// actually finish, did it include every required section, is there a
// complete (has main()) C++ program to grade, and did it avoid raw LaTeX
// (which this site has no renderer for and shows as literal $ signs).
// Catches the "unfinished, missing a section, or full of LaTeX" failure
// modes before it ever reaches the judge.
function checkStructure(
  editorial: string,
  truncated: boolean
): { ok: boolean; issues: string[]; cppCode: string | null } {
  const issues: string[] = [];
  if (truncated) {
    issues.push("The response was cut off before finishing (hit the token limit).");
  }
  for (const heading of REQUIRED_SECTIONS) {
    if (!editorial.includes(heading)) {
      issues.push(`Missing the "${heading}" section.`);
    }
  }
  if (LATEX_RE.test(stripCodeBlocks(editorial))) {
    issues.push("Contains raw LaTeX math syntax (e.g. $...$, \\frac, \\le, a_i subscripts) which renders as literal text on this site — rewrite all math in plain text (a[i], <=, O(n log n)).");
  }
  const cppCode = extractCppCode(editorial);
  if (!cppCode) {
    issues.push("No parseable C++ code block found (missing ```cpp fence or it wasn't closed).");
  } else if (!MAIN_FN_RE.test(cppCode)) {
    issues.push("The C++ code block doesn't contain a main() function — it's not a complete program.");
  }
  return { ok: issues.length === 0, issues, cppCode };
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
): Promise<{ editorial: string | null; validated: boolean }> {
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

  const isInfraFailure = (details: string) =>
    details === "Judge service unavailable" || details.startsWith("Judge error:");

  let editorial = "";
  let validated = false;
  let structurallyOk = false;
  let lastFeedback: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const isFinalAttempt = attempt === MAX_RETRIES;
    structurallyOk = false;

    // Build a fresh prompt each retry instead of accumulating history
    const userContent = buildUserPrompt(
      problemName, tags, rating, contestId, index, statement, lastFeedback
    );

    // Attempt 1 uses callLLM (Gemini → Haiku fallback). Middle retries use
    // Gemini only (free). The final attempt forces Haiku specifically —
    // if Gemini has been consistently wrong or truncating on this problem,
    // repeating the same model is unlikely to fix it; a different model
    // gets one real shot before giving up.
    const result = attempt === 1
      ? await callLLM(SYSTEM_PROMPT, userContent, 16384)
      : isFinalAttempt
        ? await callHaikuOnly(SYSTEM_PROMPT, userContent, 16384)
        : await callGeminiOnly(SYSTEM_PROMPT, userContent, 16384);

    console.log(`  [${result.provider}] editorial attempt ${attempt}: ${result.text.length} chars${result.truncated ? " (TRUNCATED)" : ""}`);
    editorial = result.text;

    // Cheap, objective checks first — don't waste a judge call on output
    // that's missing sections or was cut off before finishing.
    const structure = checkStructure(editorial, result.truncated);
    if (!structure.ok) {
      console.log(`  ⚠️  structural issues: ${structure.issues.join(" ")}`);
      if (!isFinalAttempt) {
        lastFeedback = `Your previous response had structural problems:\n${structure.issues.map((i) => `- ${i}`).join("\n")}\n\nProvide a COMPLETE editorial with every required section (## Intuition, ## Approach, ## Complexity, ## Solution (C++)) and exactly one complete, properly closed C++ code block containing a full main() function. Be concise so the response fits comfortably — shorten prose, not code. Output the full editorial again from scratch.`;
      }
      continue;
    }
    structurallyOk = true;

    const cppCode = structure.cppCode!;

    if (validationTestCases.length > 0) {
      const validation = await validateSolution(cppCode, validationTestCases, limits);

      if (validation.passed) {
        validated = true;
        break;
      }

      if (isInfraFailure(validation.details)) {
        // Judge was unreachable — not a code problem, don't burn a retry
        // telling the model to "fix the algorithm" when nothing was wrong.
        console.log(`  ⚠️  judge unavailable, accepting unvalidated: ${validation.details}`);
        break;
      }

      if (!isFinalAttempt) {
        lastFeedback = `Your solution failed on attempt ${attempt}. Here are the details:\n\n${validation.details}\n\nPlease provide a COMPLETE corrected solution that passes ALL test cases. Fix the algorithmic error and output the full editorial again.`;
        continue;
      }

      // Final attempt still produces a demonstrably wrong answer against
      // ground-truth test cases — refuse to ship a known-incorrect solution
      // instead of saving it with just a console warning nobody watches.
      console.error(`  ❌ solution failed validation on final attempt — refusing to save a known-incorrect editorial:\n${validation.details}`);
      return { editorial: null, validated: false };
    }

    // No ground-truth test cases available to check behavior against — at
    // least confirm the code compiles instead of skipping validation entirely.
    const compileCheck = await validateSolution(cppCode, [], limits);
    if (!compileCheck.passed && compileCheck.details.startsWith("Compilation Error")) {
      console.log(`  ⚠️  compile-only check failed: ${compileCheck.details.split("\n")[0]}`);
      if (!isFinalAttempt) {
        lastFeedback = `Your solution does not compile:\n\n${compileCheck.details}\n\nProvide a COMPLETE corrected editorial with a solution that compiles cleanly.`;
        continue;
      }
      console.error(`  ❌ solution still doesn't compile on final attempt — refusing to save a broken editorial`);
      return { editorial: null, validated: false };
    }

    // Compiles cleanly (or judge was unreachable) but never behaviorally
    // proven against real test cases — accurately reported as unvalidated.
    break;
  }

  if (!structurallyOk) {
    console.error(`  ❌ editorial never reached a structurally complete state after ${MAX_RETRIES} attempts (missing sections, no code block, truncated, or raw LaTeX) — refusing to save a broken editorial`);
    return { editorial: null, validated: false };
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
): Promise<string | null> {
  const { editorial } = await generateValidatedEditorial(
    problemName, tags, rating, contestId, index, statement
  );
  return editorial;
}
