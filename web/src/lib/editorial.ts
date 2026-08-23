import OpenAI from "openai";
import { ProblemStatement } from "./codeforces";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEditorial(
  problemName: string,
  tags: string[],
  rating: number,
  contestId: number,
  index: string,
  statement?: ProblemStatement | null
): Promise<string> {
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

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content: `You are a competitive programming tutor writing LeetCode-style editorials for Codeforces problems. Write clear, educational solutions. Format everything in markdown. Use ## for sections, \`code\` for inline code, and fenced code blocks for C++ solutions. Be concise but thorough.`,
      },
      {
        role: "user",
        content: `Write an editorial for this Codeforces problem. IMPORTANT: You must write a COMPLETE, fully working C++ solution. Do NOT write stubs, placeholders, or comments like "// implement your solution here". The code must be ready to submit.

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

Keep it clear and educational. Assume the reader understands basic data structures but may not know the specific algorithm technique needed.`,
      },
    ],
  });

  return response.choices[0]?.message?.content || "";
}
