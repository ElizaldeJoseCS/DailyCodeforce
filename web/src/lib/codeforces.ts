interface CFProblem {
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
}

interface CFResponse {
  status: string;
  result: {
    problems: CFProblem[];
    problemStatistics: unknown[];
  };
}

const BASE_URL = "https://codeforces.com/api";

export async function fetchAllProblems(): Promise<CFProblem[]> {
  const res = await fetch(`${BASE_URL}/problemset.problems`);
  if (!res.ok) throw new Error(`Codeforces API error: ${res.status}`);
  const data: CFResponse = await res.json();
  if (data.status !== "OK") throw new Error("Codeforces API returned error");
  return data.result.problems.filter(
    (p) => p.rating !== undefined && p.rating !== null
  );
}

export async function fetchProblemsByRating(
  min: number,
  max: number
): Promise<CFProblem[]> {
  const all = await fetchAllProblems();
  return all.filter((p) => p.rating >= min && p.rating <= max);
}

export function problemUrl(p: { contestId: number; index: string }): string {
  return `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;
}

export function editorialUrl(contestId: number): string {
  return `https://codeforces.com/blog/entry/${contestId}`;
}

export type { CFProblem };
