import type { Metadata } from "next";

// Public origin used for canonical URLs, Open Graph tags, and the sitemap.
export const SITE_URL = (process.env.SITE_URL || "https://codeforces-practice.com").replace(/\/$/, "");

export const SITE_NAME = "DailyCodeforce";

export const SITE_DESCRIPTION =
  "Daily Codeforces practice: four new problems every day, one per difficulty tier, each with a step-by-step editorial and a tested C++ solution. Submit your code to our judge and track your streak.";

// Plain-text snippet from an editorial's "## Intuition" section (falls back to
// the first prose paragraph) for use as a meta description. Strips markdown
// and code so search results show readable sentences, not syntax.
export function editorialSnippet(editorial: string, maxLength = 155): string | null {
  const withoutCode = editorial.replace(/```[\s\S]*?```/g, "");
  const intuition = withoutCode.match(/##\s*Intuition\s*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1];
  const source = intuition ?? withoutCode;
  const text = source
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s.*$/gm, "")
    .replace(/[*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

// Full per-page metadata. Next merges metadata shallowly, so a page that sets
// openGraph at all replaces the layout's openGraph wholesale — build every
// field here instead of setting just the url.
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
}: {
  title?: string;
  description: string;
  path: string;
  type?: "website" | "article";
}): Metadata {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} – Daily Codeforces Practice`;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { type, siteName: SITE_NAME, url: path, title: fullTitle, description },
    twitter: { card: "summary", title: fullTitle, description },
  };
}
