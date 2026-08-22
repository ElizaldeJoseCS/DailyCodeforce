"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Code2, Search, LogIn, LogOut, User, X } from "lucide-react";

interface SearchResult {
  users: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    discordAvatar: string | null;
    totalSolved: number;
    currentStreak: number;
  }[];
  problems: {
    id: string;
    name: string;
    rating: number;
    tags: string[];
    dailyProblems: { id: string; tier: string; date: string }[];
  }[];
}

interface SessionUser {
  id?: string;
  username?: string;
  image?: string | null;
}

export function Navbar() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then(setResults)
        .catch(() => setResults(null))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const tierColors: Record<string, string> = {
    beginner: "text-emerald-400",
    intermediate: "text-blue-400",
    advanced: "text-orange-400",
    expert: "text-red-400",
  };

  const username = user?.username;

  return (
    <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg flex-shrink-0">
          <Code2 className="w-5 h-5 text-cyan-400" />
          <span className="hidden sm:inline">DailyCodeforce</span>
        </Link>

        <div className="flex items-center gap-4 text-sm text-gray-400">
          <Link href="/" className="hover:text-white transition-colors hidden sm:block">
            Today
          </Link>
          <Link href="/archive" className="hover:text-white transition-colors hidden sm:block">
            Archive
          </Link>
          <Link href="/leaderboard" className="hover:text-white transition-colors hidden sm:block">
            Leaderboard
          </Link>
        </div>

        {/* Search */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          >
            <Search className="w-4 h-4" />
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
              <div className="p-3 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-500" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search users or problems..."
                    className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="text-gray-500 hover:text-gray-300">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {searching && (
                  <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
                )}

                {!searching && results && results.users.length === 0 && results.problems.length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-500">No results</div>
                )}

                {!searching && results?.users.length ? (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">Users</div>
                    {results.users.map((u) => (
                      <Link
                        key={u.username}
                        href={`/profile/${u.username}`}
                        onClick={() => { setOpen(false); setQuery(""); }}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
                          {u.avatarUrl || u.discordAvatar ? (
                            <img src={u.avatarUrl || u.discordAvatar || ""} alt="" className="w-full h-full object-cover" />
                          ) : (
                            u.username[0].toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-200 truncate">{u.displayName || u.username}</p>
                          <p className="text-xs text-gray-500">@{u.username} · {u.totalSolved} solved</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {!searching && results?.problems.length ? (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">Problems</div>
                    {results.problems.map((p) => (
                      <Link
                        key={p.id}
                        href={p.dailyProblems[0] ? `/problem/${p.dailyProblems[0].id}` : "#"}
                        onClick={() => { setOpen(false); setQuery(""); }}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-800 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-gray-200 truncate">{p.name}</p>
                          <p className="text-xs text-gray-500">
                            {p.tags.slice(0, 2).join(", ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {p.dailyProblems[0] && (
                            <span className={`text-xs ${tierColors[p.dailyProblems[0].tier] || "text-gray-500"}`}>
                              {p.dailyProblems[0].tier}
                            </span>
                          )}
                          <span className="text-xs font-mono text-gray-400">{p.rating}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Auth */}
        {session ? (
          <div className="flex items-center gap-3">
            <Link
              href={`/profile/${username}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors text-sm text-gray-300"
            >
                {user?.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="w-6 h-6 rounded-full"
                  />
              ) : (
                <User className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{username}</span>
            </Link>
            <button
              onClick={() => signOut()}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/auth/signin"
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Sign in</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
