import OpenAI from "openai";
import { ProblemStatement } from "./codeforces";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const JUDGE_URL = process.env.JUDGE_URL || "http://judge:8080";

const SYSTEM_PROMPT = `You are a competitive programming tutor writing LeetCode-style editorials for Codeforces problems. Write clear, educational solutions. Format everything in markdown. Use ## for sections, \`code\` for inline code, and fenced code blocks for C++ solutions. Be concise but thorough.`;

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

  let problemContext = `**Problem:** ${problemName} (Contest ${contestId}, Problem ${index})
**Difficulty:** ${rating}
**Tags:** ${tagStr}`;

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

  let prompt = `Write an editorial for this Codeforces problem. IMPORTANT: You must write a COMPLETE, fully working C++ solution. Do NOT write stubs, placeholders, or comments like "// implement your solution here". The code must be ready to submit.

${problemContext}

Structure your editorial as:
## Intuition
Brief explanation of the key insight.

## Approach
Step-by-step algorithm description.

## Complexity
- Time: O(...)
- Space: O(...)

## Solution (C++)
Write a COMPLETE C++ solution using this template structure:
\`\`\`cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Complete working solution here - read input, compute, output answer

    return 0;
}
\`\`\`

Rules for the code:
- Include ALL necessary headers (already provided via bits/stdc++.h)
- Read ALL input exactly as specified in the problem (IMPORTANT: pay attention to multi-test-case format where the first line is t)
- Implement the FULL algorithm, not a skeleton
- Output the answer exactly as the problem requires
- Include fast I/O (ios::sync_with_stdio(false); cin.tie(nullptr);)
- The code should be submittable directly to Codeforces

Keep it clear and educational. Assume the reader understands basic data structures but may not know the specific algorithm technique needed.`;

  if (feedback) {
    prompt += `

**IMPORTANT: Your previous solution had errors. Here is the feedback:**

${feedback}

Please provide a COMPLETE corrected editorial with a working solution that fixes these errors. The solution must compile and pass all test cases.`;
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
  const match = markdown.match(/```cpp\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  const match2 = markdown.match(/```c\+\+\n([\s\S]*?)```/);
  if (match2) return match2[1].trim();
  return null;
}

export async function generateExtraTestCases(
  problemName: string,
  statement: ProblemStatement
): Promise<{ input: string; output: string }[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 3000,
      messages: [
        { role: "system", content: TEST_CASE_PROMPT },
        { role: "user", content: buildTestCasePrompt(problemName, statement) },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const testCases = JSON.parse(jsonMatch[0]) as { input: string; output: string }[];

    // Validate format
    return testCases.filter(
      (tc) =>
        typeof tc.input === "string" &&
        typeof tc.output === "string" &&
        tc.input.length > 0 &&
        tc.output.length > 0
    );
  } catch {
    return [];
  }
}

export async function validateSolution(
  sourceCode: string,
  testCases: { input: string; output: string }[]
): Promise<{ passed: boolean; details: string }> {
  try {
    const res = await fetch(`${JUDGE_URL}/judge/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceCode, testCases }),
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
): Promise<string> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // Generate extra validation test cases from the problem statement
  let extraTestCases: { input: string; output: string }[] = [];
  if (statement && statement.examples.length > 0) {
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

  let editorial = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const feedback = attempt > 1
      ? messages.length > 2
        ? (messages[messages.length - 1] as { content?: string }).content || ""
        : undefined
      : undefined;

    const userContent = buildUserPrompt(
      problemName, tags, rating, contestId, index, statement, feedback
    );

    messages.push({ role: "user", content: userContent });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: attempt === 1 ? 0.3 : 0.2,
      max_tokens: 4000,
      messages,
    });

    editorial = response.choices[0]?.message?.content || "";

    messages.push({ role: "assistant", content: editorial });

    if (validationTestCases.length === 0) {
      break;
    }

    const cppCode = extractCppCode(editorial);
    if (!cppCode) {
      break;
    }

    const validation = await validateSolution(cppCode, validationTestCases);

    if (validation.passed) {
      break;
    }

    if (attempt < MAX_RETRIES) {
      messages.push({
        role: "user",
        content: `Your solution failed on attempt ${attempt}. Here are the details:\n\n${validation.details}\n\nPlease provide a COMPLETE corrected solution that passes ALL test cases. Fix the algorithmic error and output the full editorial again.`,
      });
    }
  }

  return editorial;
}

export async function generateEditorial(
  problemName: string,
  tags: string[],
  rating: number,
  contestId: number,
  index: string,
  statement?: ProblemStatement | null
): Promise<string> {
  return generateValidatedEditorial(
    problemName, tags, rating, contestId, index, statement
  );
}
