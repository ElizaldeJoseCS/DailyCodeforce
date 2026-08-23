import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAllProblems, problemUrl, scrapeTestCases } from "@/lib/codeforces";
import { TIERS, TIER_ORDER } from "@/lib/tiers";

const DEDUP_WINDOW_DAYS = 90;
const TAG_ROTATION_WINDOW_DAYS = 14;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allProblems = await fetchAllProblems();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results: string[] = [];

  for (const tier of TIER_ORDER) {
    const { min, max } = TIERS[tier];
    const candidates = allProblems.filter(
      (p) => p.rating >= min && p.rating <= max
    );

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DEDUP_WINDOW_DAYS);

    const recentProblemIds = (
      await prisma.dailyProblem.findMany({
        where: { tier, date: { gte: cutoff } },
        select: { problemId: true },
      })
    ).map((dp) => dp.problemId);

    const recentCfs = (
      await prisma.problem.findMany({
        where: { id: { in: recentProblemIds } },
        select: { cfContestId: true, cfIndex: true },
      })
    ).map((p) => `${p.cfContestId}-${p.cfIndex}`);

    const available = candidates.filter(
      (p) => !recentCfs.includes(`${p.contestId}-${p.index}`)
    );

    if (available.length === 0) {
      results.push(`${tier}: no available problems`);
      continue;
    }

    const tagCutoff = new Date();
    tagCutoff.setDate(tagCutoff.getDate() - TAG_ROTATION_WINDOW_DAYS);

    const recentTagProblems = await prisma.dailyProblem.findMany({
      where: { tier, date: { gte: tagCutoff } },
      select: { problem: { select: { tags: true } } },
    });

    const tagCounts: Record<string, number> = {};
    for (const rp of recentTagProblems) {
      if (!rp.problem.tags) continue;
      const tags = Array.isArray(rp.problem.tags) ? rp.problem.tags : [];
      for (const tag of tags) {
        const t = String(tag).trim().toLowerCase();
        if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }

    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => a[1] - b[1])
      .map(([tag]) => tag);

    const underused = sortedTags.slice(0, 3);

    let picked = available[Math.floor(Math.random() * available.length)];

    if (underused.length > 0) {
      const tagPreferred = available.filter((p) => {
        if (!p.tags) return false;
        const pTags = p.tags.map((t) => t.toLowerCase());
        return underused.some((ut) => pTags.includes(ut));
      });
      if (tagPreferred.length > 0) {
        picked = tagPreferred[Math.floor(Math.random() * tagPreferred.length)];
      }
    }

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

    if (!problem.testCases) {
      try {
        const testCases = await scrapeTestCases(picked.contestId, picked.index);
        if (testCases.length > 0) {
          await prisma.problem.update({
            where: { id: problem.id },
            data: { testCases: JSON.parse(JSON.stringify(testCases)) },
          });
        }
      } catch (e) {
        console.error(`Failed to scrape test cases for ${picked.contestId}${picked.index}:`, e);
      }
    }

    const existingToday = await prisma.dailyProblem.findFirst({
      where: { date: today, tier },
    });

    if (!existingToday) {
      await prisma.dailyProblem.create({
        data: {
          problemId: problem.id,
          tier,
          date: today,
          editorialUrl: `https://codeforces.com/blog/entry/${picked.contestId}`,
        },
      });
      results.push(`${tier}: assigned "${picked.name}" (${picked.rating})`);
    } else {
      results.push(`${tier}: already assigned`);
    }
  }

  return NextResponse.json({ results });
}
