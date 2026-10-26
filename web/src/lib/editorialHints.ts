// Progressive hints are cut straight from the generated editorial's own
// sections (editorial.ts requires ## Intuition / ## Approach), so they need
// no extra LLM calls. Missing or empty sections are simply skipped.
export interface EditorialHint {
  label: string;
  body: string;
}

function section(markdown: string, heading: string): string | null {
  const match = markdown.match(new RegExp(`^##\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, "im"));
  const body = match?.[1].trim();
  // A hint must never leak the solution code.
  return body && !body.includes("```") ? body : null;
}

export function editorialHints(markdown: string): EditorialHint[] {
  const hints: EditorialHint[] = [];
  const intuition = section(markdown, "Intuition");
  if (intuition) hints.push({ label: "Key insight", body: intuition });
  const approach = section(markdown, "Approach");
  if (approach) hints.push({ label: "Approach", body: approach });
  return hints;
}
