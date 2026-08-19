"use client";

import Link from "next/link";
import { Code2 } from "lucide-react";

export function Navbar() {
  return (
    <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Code2 className="w-5 h-5 text-cyan-400" />
          <span>DailyCodeforce</span>
        </Link>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <Link href="/" className="hover:text-white transition-colors">
            Today
          </Link>
          <Link href="/archive" className="hover:text-white transition-colors">
            Archive
          </Link>
          <Link
            href="/leaderboard"
            className="hover:text-white transition-colors"
          >
            Leaderboard
          </Link>
        </div>
      </div>
    </nav>
  );
}
