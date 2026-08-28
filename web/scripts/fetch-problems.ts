import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { scrapeProblemStatement } from "../src/lib/codeforces.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, "../.env");
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const DEDUP_WINDOW_DAYS = 90;

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

async function fetchAllProblems(): Promise<CFProblem[]> {
  console.log("Fetching problems from Codeforces API...");
  const res = await fetch("https://codeforces.com/api/problemset.problems");
  if (!res.ok) throw new Error(`Codeforces API error: ${res.status}`);
  const data: CFResponse = await res.json();
  if (data.status !== "OK") throw new Error("Codeforces API returned error");
  return data.result.problems.filter(
    (p) => p.rating !== undefined && p.rating !== null
  );
}

function problemUrl(p: { contestId: number; index: string }): string {
  return `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;
}

const TIERS: Record<string, { min: number; max: number }> = {
  beginner: { min: 800, max: 1000 },
  intermediate: { min: 1100, max: 1500 },
  advanced: { min: 1600, max: 2000 },
  expert: { min: 2100, max: 3500 },
};

const TIER_ORDER = ["beginner", "intermediate", "advanced", "expert"];

async function getUsedCfIds(tier: string): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DEDUP_WINDOW_DAYS);

  const recentProblemIds = (
    await prisma.dailyProblem.findMany({
      where: { tier, date: { gte: cutoff } },
      select: { problemId: true },
    })
  ).map((dp) => dp.problemId);

  if (recentProblemIds.length === 0) return [];

  const recentCfs = await prisma.problem.findMany({
    where: { id: { in: recentProblemIds } },
    select: { cfContestId: true, cfIndex: true },
  });

  return recentCfs.map((p) => `${p.cfContestId}-${p.cfIndex}`);
}

async function seedProblems() {
  const allProblems = await fetchAllProblems();
  console.log(`Fetched ${allProblems.length} rated problems`);

  for (const tier of TIER_ORDER) {
    const { min, max } = TIERS[tier];
    const candidates = allProblems.filter(
      (p) => p.rating >= min && p.rating <= max
    );

    const usedCfIds = await getUsedCfIds(tier);
    const available = candidates.filter(
      (p) => !usedCfIds.includes(`${p.contestId}-${p.index}`)
    );

    if (available.length === 0) {
      console.warn(`No available problems for tier ${tier}, skipping`);
      continue;
    }

    const picked = available[Math.floor(Math.random() * available.length)];

    const problem = await prisma.problem.upsert({
      where: {
        cfContestId_cfIndex: {
          cfContestId: picked.contestId,
          cfIndex: picked.index,
        },
      },
      create: {
        cfContestId: picked.contestId,
        cfIndex: picked.index,
        name: picked.name,
        rating: picked.rating,
        tags: picked.tags,
        url: problemUrl(picked),
      },
      update: {},
    });

    // Scrape the full statement (once) if missing — this also gives us the
    // sample test cases, so the page and editorial generation can both read
    // the cached statement/testCases instead of re-scraping Codeforces later.
    const existingProblem = await prisma.problem.findUnique({
      where: { id: problem.id },
      select: { statement: true, testCases: true },
    });
    if (!existingProblem?.statement) {
      console.log(`  Scraping statement for ${picked.name}...`);
      const statement = await scrapeProblemStatement(picked.contestId, picked.index);
      if (statement) {
        await prisma.problem.update({
          where: { id: problem.id },
          data: {
            statement: statement as unknown as Record<string, unknown>,
            testCases: statement.examples as unknown as Record<string, unknown>[],
          },
        });
        console.log(`  → statement cached, ${statement.examples.length} test cases saved`);
      } else {
        console.log(`  → Failed to scrape statement`);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.dailyProblem.findFirst({
      where: { date: today, tier },
    });

    if (!existing) {
      await prisma.dailyProblem.create({
        data: {
          problemId: problem.id,
          tier,
          date: today,
          editorialUrl: `https://codeforces.com/blog/entry/${picked.contestId}`,
        },
      });
      console.log(
        `✅ ${tier}: "${picked.name}" (${picked.rating})`
      );
    } else {
      console.log(`⏭️  ${tier}: already assigned`);
    }
  }
}

async function backfillProblems(days: number) {
  console.log(`Backfilling ${days} days of problems...`);
  const allProblems = await fetchAllProblems();
  console.log(`Fetched ${allProblems.length} rated problems`);

  for (let d = days; d >= 1; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    date.setHours(0, 0, 0, 0);

    for (const tier of TIER_ORDER) {
      const { min, max } = TIERS[tier];
      const candidates = allProblems.filter(
        (p) => p.rating >= min && p.rating <= max
      );

      const usedCfIds = await getUsedCfIds(tier);
      const available = candidates.filter(
        (p) => !usedCfIds.includes(`${p.contestId}-${p.index}`)
      );

      if (available.length === 0) continue;

      const picked = available[Math.floor(Math.random() * available.length)];

      const problem = await prisma.problem.upsert({
        where: {
          cfContestId_cfIndex: {
            cfContestId: picked.contestId,
            cfIndex: picked.index,
          },
        },
        create: {
          cfContestId: picked.contestId,
          cfIndex: picked.index,
          name: picked.name,
          rating: picked.rating,
          tags: picked.tags,
          url: problemUrl(picked),
        },
        update: {},
      });

      const existing = await prisma.dailyProblem.findFirst({
        where: { date, tier },
      });

      if (!existing) {
        await prisma.dailyProblem.create({
          data: {
            problemId: problem.id,
            tier,
            date,
            editorialUrl: `https://codeforces.com/blog/entry/${picked.contestId}`,
          },
        });
      }
    }

    const usedNow = await getUsedCfIds("beginner");
    console.log(
      `📅 ${date.toISOString().split("T")[0]} done (${usedNow.length} used total)`
    );
  }
  console.log("Backfill done!");
}

const command = process.argv[2];
if (command === "backfill") {
  const days = parseInt(process.argv[3] || "30");
  backfillProblems(days).catch(console.error);
} else {
  seedProblems().catch(console.error);
}

process.on("exit", () => prisma.$disconnect());
