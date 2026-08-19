import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEditorial(
  problemName: string,
  tags: string[],
  rating: number,
  contestId: number,
  index: string
): Promise<string> {
  const tagStr = tags.join(", ");
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content: `You are a competitive programming tutor writing LeetCode-style editorials. Write clear, educational solutions. Always include C++ code. Format in markdown. Use ## for sections, \`code\` for inline code, and fenced code blocks for C++ solutions. Be concise but thorough.`,
      },
      {
        role: "user",
        content: `Write an editorial for this Codeforces problem:

**Problem:** ${problemName} (Contest ${contestId}, Problem ${index})
**Difficulty:** ${rating}
**Tags:** ${tagStr}

Structure your editorial as:
## Intuition
Brief explanation of the key insight.

## Approach
Step-by-step algorithm description.

## Complexity
- Time: O(...)
- Space: O(...)

## Solution (C++)
\`\`\`cpp
// Complete working C++ solution
\`\`\`

Keep it clear and educational. Assume the reader understands basic data structures but may not know the specific algorithm technique needed.`,
      },
    ],
  });

  return response.choices[0]?.message?.content || "";
}
