import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

// page.tsx is a client component and can't export metadata itself.
export const metadata: Metadata = pageMetadata({
  title: "Codeforces Problem Set – Browse by Rating and Tag",
  description:
    "Browse Codeforces practice problems by rating and tag, from beginner to expert, with AI editorials and C++ solutions for every daily problem.",
  path: "/problems",
});

export default function ProblemsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
