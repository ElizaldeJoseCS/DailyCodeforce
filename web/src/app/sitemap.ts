import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

// Query at request time — a static sitemap would hit the DB during
// `next build`, which has no database to reach in the Docker build.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only problem pages with an editorial: those carry unique content. Pages
  // that are just the scraped CF statement duplicate codeforces.com.
  const problems = await prisma.dailyProblem.findMany({
    where: { editorial: { not: null } },
    select: { id: true, date: true },
    orderBy: { date: "desc" },
  });

  const latest = problems[0]?.date ?? new Date();

  return [
    { url: `${SITE_URL}/`, lastModified: latest, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/problems`, lastModified: latest, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/archive`, lastModified: latest, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/leaderboard`, changeFrequency: "daily", priority: 0.4 },
    ...problems.map((p) => ({
      url: `${SITE_URL}/problem/${p.id}`,
      lastModified: p.date,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
