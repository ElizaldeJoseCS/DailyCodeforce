interface CFProblem {
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
}

interface CFProblemResponse {
  status: string;
  result: {
    problems: CFProblem[];
    problemStatistics: unknown[];
  };
}

interface CFUserResponse {
  status: string;
  result: {
    handle: string;
    avatar: string;
    rating?: number;
    rank?: string;
  };
}

interface CFSubmission {
  id: number;
  contestId: number;
  problem: { contestId: number; index: string; name: string };
  verdict: string;
  creationTimeSeconds: number;
}

interface CFUserStatusResponse {
  status: string;
  result: CFSubmission[];
}

const BASE_URL = "https://codeforces.com/api";

export async function fetchAllProblems(): Promise<CFProblem[]> {
  const res = await fetch(`${BASE_URL}/problemset.problems`);
  if (!res.ok) throw new Error(`Codeforces API error: ${res.status}`);
  const data: CFProblemResponse = await res.json();
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

export async function verifyCFHandle(handle: string): Promise<{ valid: boolean; avatar?: string; rating?: number; rank?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/user.info?handles=${handle}`);
    if (!res.ok) return { valid: false };
    const data: CFUserResponse = await res.json();
    if (data.status !== "OK" || !data.result) return { valid: false };
    const user = data.result;
    return {
      valid: true,
      avatar: user.avatar,
      rating: user.rating,
      rank: user.rank,
    };
  } catch {
    return { valid: false };
  }
}

export async function checkUserSolve(
  cfHandle: string,
  contestId: number,
  problemIndex: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `${BASE_URL}/user.status?handle=${cfHandle}&from=1&count=100`
    );
    if (!res.ok) return false;
    const data: CFUserStatusResponse = await res.json();
    if (data.status !== "OK") return false;

    return data.result.some(
      (sub) =>
        sub.verdict === "OK" &&
        sub.problem.contestId === contestId &&
        sub.problem.index === problemIndex
    );
  } catch {
    return false;
  }
}

export async function checkAllUserSolves(
  cfHandle: string,
  problems: { contestId: number; index: string; dailyProblemId: string }[]
): Promise<string[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/user.status?handle=${cfHandle}&from=1&count=200`
    );
    if (!res.ok) return [];
    const data: CFUserStatusResponse = await res.json();
    if (data.status !== "OK") return [];

    const solved = new Set<string>();
    for (const sub of data.result) {
      if (sub.verdict === "OK") {
        solved.add(`${sub.problem.contestId}-${sub.problem.index}`);
      }
    }

    return problems
      .filter((p) => solved.has(`${p.contestId}-${p.index}`))
      .map((p) => p.dailyProblemId);
  } catch {
    return [];
  }
}

export type { CFProblem };
