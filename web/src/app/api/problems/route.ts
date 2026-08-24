import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const minRating = parseInt(req.nextUrl.searchParams.get("minRating") || "0");
  const maxRating = parseInt(req.nextUrl.searchParams.get("maxRating") || "9999");
  const tag = req.nextUrl.searchParams.get("tag") || "";
  const solved = req.nextUrl.searchParams.get("solved"); // "true", "false", or null
  const search = req.nextUrl.searchParams.get("q") || "";
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = 50;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    rating: { gte: minRating || undefined, lte: maxRating || undefined },
  };

  if (tag) {
    where.tags = { has: tag };
  }

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  // If filtering by solved status, we need dailyProblems with user progress
  const include = {
    dailyProblems: {
      select: {
        id: true,
        tier: true,
        date: true,
        ...(solved
          ? {
              userProgress: {
                select: { id: true, verified: true },
                take: 1,
              },
            }
          : {}),
      },
      orderBy: { date: "desc" as const },
      take: 1,
    },
  };

  const [problems, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      include,
      orderBy: { rating: "desc" },
      skip,
      take: limit,
    }),
    prisma.problem.count({ where }),
  ]);

  // Filter by solved status after query
  let filtered = problems;
  if (solved === "true") {
    filtered = problems.filter(
      (p) => p.dailyProblems[0] && (p.dailyProblems[0] as Record<string, unknown>).userProgress
    );
  } else if (solved === "false") {
    filtered = problems.filter(
      (p) => !p.dailyProblems[0] || !(p.dailyProblems[0] as Record<string, unknown>).userProgress
    );
  }

  // Get all unique tags for filter options
  const allTags = await prisma.$queryRaw<{ tags: string[] }[]>`
    SELECT DISTINCT unnest(tags) as tags FROM problems ORDER BY tags
  `;

  return NextResponse.json({
    problems: filtered.map((p) => ({
      id: p.id,
      name: p.name,
      rating: p.rating,
      tags: p.tags,
      url: p.url,
      dailyProblem: p.dailyProblems[0] || null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    availableTags: allTags.map((r) => r.tags).filter(Boolean),
  });
}
