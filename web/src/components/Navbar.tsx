"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  Code2,
  Search,
  LogIn,
  LogOut,
  User,
  X,
  Sun,
  Moon,
  Menu,
} from "lucide-react";

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
  needsCfLink?: boolean;
}

export function Navbar() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.needsCfLink) {
      router.push("/auth/setup");
    }
  }, [user, router]);

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
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) setMobileOpen(false);
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    fetch(`/api/users/${username}`)
      .then((r) => r.json())
      .then((d) => setAvatarUrl(d.avatarUrl || d.discordAvatar))
      .catch(() => {});
  }, [username]);

  const navLinks = (
    <>
      <Link href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>
        Today
      </Link>
      <Link href="/problems" className="hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>
        Problems
      </Link>
      <Link href="/archive" className="hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>
        Archive
      </Link>
      <Link href="/leaderboard" className="hover:text-gray-900 dark:hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>
        Leaderboard
      </Link>
    </>
  );

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg flex-shrink-0">
          <Code2 className="w-5 h-5 text-cyan-400" />
          <span className="hidden sm:inline">DailyCodeforce</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center gap-4 text-sm text-gray-400">
          {navLinks}
        </div>

        {/* Search */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="p-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors text-gray-400 hover:text-white"
          >
            <Search className="w-4 h-4" />
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-80 bg-gray-900 dark:bg-gray-900 bg-white border border-gray-700 dark:border-gray-700 border-gray-200 rounded-xl shadow-2xl overflow-hidden">
              <div className="p-3 border-b border-gray-800 dark:border-gray-800 border-gray-200">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-500" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search users or problems..."
                    className="flex-1 bg-transparent text-sm text-gray-100 dark:text-gray-100 text-gray-900 placeholder-gray-500 focus:outline-none"
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
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors"
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
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-800 dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors"
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

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors text-gray-400 hover:text-white"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Auth */}
        {session ? (
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href={`/profile/${username}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors text-sm text-gray-300"
            >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                <User className="w-4 h-4" />
              )}
              <span>{username}</span>
            </Link>
            <button
              onClick={() => signOut()}
              className="p-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors text-gray-400 hover:text-white"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/auth/signin"
            className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign in</span>
          </Link>
        )}

        {/* Mobile hamburger */}
        <div ref={mobileRef} className="sm:hidden relative">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-800 hover:bg-gray-100 transition-colors text-gray-400 hover:text-white"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {mobileOpen && (
            <div className="absolute right-0 top-12 w-56 bg-gray-900 dark:bg-gray-900 bg-white border border-gray-700 dark:border-gray-700 border-gray-200 rounded-xl shadow-2xl overflow-hidden py-2">
              <div className="flex flex-col gap-1 px-2">
                {navLinks}
              </div>
              <div className="border-t border-gray-800 dark:border-gray-800 border-gray-200 mt-2 pt-2 px-2">
                {session ? (
                  <>
                    <Link
                      href={`/profile/${username}`}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-800 hover:bg-gray-100 text-sm text-gray-300"
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                      {username}
                    </Link>
                    <button
                      onClick={() => { signOut(); setMobileOpen(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-800 hover:bg-gray-100 text-sm text-gray-400 w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth/signin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign in
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
