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

export interface TestCase {
  input: string;
  output: string;
}

export async function scrapeTestCases(
  contestId: number,
  index: string
): Promise<TestCase[]> {
  const { load } = await import("cheerio");
  const url = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "DailyCodeforceBot/1.0" },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = load(html);
  const examples: TestCase[] = [];
  $("div.sample-test").each((_, el) => {
    const inputs = $(el).find("div.input pre");
    const outputs = $(el).find("div.output pre");
    const count = Math.max(inputs.length, outputs.length);
    for (let i = 0; i < count; i++) {
      const input = extractPreText($, $(inputs[i]));
      const output = extractPreText($, $(outputs[i]));
      if (input || output) examples.push({ input, output });
    }
  });
  return examples;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPreText($: any, el: any): string {
  const lines: string[] = [];
  let current = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el.contents().each((_: number, child: any) => {
    if (child.type === "text") {
      const t = child.data || "";
      current += t;
    } else if (child.type === "tag") {
      const tag = child.tagName;
      if (tag === "br") {
        const trimmed = current.trim();
        if (trimmed) lines.push(trimmed);
        current = "";
      } else {
        if (current.trim()) {
          lines.push(current.trim());
          current = "";
        }
        lines.push($(child).text().trim());
      }
    }
  });
  const last = current.trim();
  if (last) lines.push(last);
  if (lines.length === 0) return el.text().trim();
  return lines.filter(l => l).join("\n");
}

export interface ProblemStatement {
  statement: string;
  inputSpec: string;
  outputSpec: string;
  examples: TestCase[];
  note: string;
  timeLimit: string;
  memoryLimit: string;
}

export async function scrapeProblemStatement(
  contestId: number,
  index: string
): Promise<ProblemStatement | null> {
  const { load } = await import("cheerio");
  const url = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "DailyCodeforceBot/1.0" },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const $ = load(html);

  const problemDiv = $("div.problem-statement");
  if (!problemDiv.length) return null;

  const timeLimit = problemDiv.find("div.time-limit").text().replace("time limit per test", "").trim();
  const memoryLimit = problemDiv.find("div.memory-limit").text().replace("memory limit per test", "").trim();
  const statement = problemDiv.find("div.header").next("div").children("p").text().trim();
  const inputSpec = problemDiv.find("div.input-specification").text().replace("Input", "").trim();
  const outputSpec = problemDiv.find("div.output-specification").text().replace("Output", "").trim();
  const note = problemDiv.find("div.note").text().replace("Note", "").trim();

  const examples: TestCase[] = [];
  $("div.sample-test").each((_, el) => {
    const inputs = $(el).find("div.input pre");
    const outputs = $(el).find("div.output pre");
    const count = Math.max(inputs.length, outputs.length);
    for (let i = 0; i < count; i++) {
      const input = $(inputs[i]).text().trim();
      const output = $(outputs[i]).text().trim();
      if (input || output) examples.push({ input, output });
    }
  });

  return { statement, inputSpec, outputSpec, examples, note, timeLimit, memoryLimit };
}
