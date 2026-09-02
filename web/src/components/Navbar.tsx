"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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
  ExternalLink,
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
    url: string;
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
  const pathname = usePathname();
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
  const avatarUrl = user?.image || null;

  const NAV_ITEMS = [
    { href: "/", label: "Today" },
    { href: "/problems", label: "Problems" },
    { href: "/archive", label: "Archive" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];

  const navLinks = (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-3 py-2 rounded-sm font-bold transition-colors ${
            pathname === item.href
              ? "bg-cyan-600/20 text-cyan-600 dark:text-cyan-300"
              : "hover:bg-cyan-600/10 hover:text-cyan-700 dark:hover:text-cyan-300"
          }`}
          onClick={() => setMobileOpen(false)}
        >
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <nav className="xp-titlebar sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.45)]">
          <span className="w-9 h-9 rounded-sm bg-gradient-to-br from-yellow-200 to-yellow-500 border border-yellow-700 flex items-center justify-center flex-shrink-0 shadow-[0_2px_0_rgba(0,0,0,0.25)]">
            <Code2 className="w-5 h-5 text-yellow-900" />
          </span>
          <span className="hidden sm:flex flex-col leading-tight">
            <span className="font-bold text-lg tracking-wide">DailyCodeforce</span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-cyan-100/80">
              four problems a day
            </span>
          </span>
        </Link>

        {/* Search */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm hover:bg-white/20 transition-colors text-white/90 hover:text-white"
          >
            <Search className="w-4 h-4" />
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-80 xp-panel overflow-hidden text-gray-900 dark:text-gray-100">
              <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-500" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search users or problems..."
                    className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
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
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
                          {u.avatarUrl || u.discordAvatar ? (
                            <img src={u.avatarUrl || u.discordAvatar || ""} alt="" className="w-full h-full object-cover" />
                          ) : (
                            u.username[0].toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{u.displayName || u.username}</p>
                          <p className="text-xs text-gray-500">@{u.username} · {u.totalSolved} solved</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {!searching && results?.problems.length ? (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">Problems</div>
                    {results.problems.map((p) => {
                      const dp = p.dailyProblems[0];
                      return (
                        <Link
                          key={p.id}
                          href={dp ? `/problem/${dp.id}` : p.url}
                          target={dp ? undefined : "_blank"}
                          rel={dp ? undefined : "noopener noreferrer"}
                          title={dp ? undefined : "Not featured as a daily problem yet — opens on Codeforces in a new tab"}
                          onClick={() => { setOpen(false); setQuery(""); }}
                          className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{p.name}</p>
                            <p className="text-xs text-gray-500">
                              {p.tags.slice(0, 2).join(", ")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {dp ? (
                              <span className={`text-xs ${tierColors[dp.tier] || "text-gray-500"}`}>
                                {dp.tier}
                              </span>
                            ) : (
                              <ExternalLink className="w-3 h-3 text-gray-500" />
                            )}
                            <span className="text-xs font-mono text-gray-400">{p.rating}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm hover:bg-white/20 transition-colors text-white/90 hover:text-white"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Auth */}
        {session ? (
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href={`/profile/${username}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-sm hover:bg-white/20 transition-colors text-sm text-white"
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
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm hover:bg-white/20 transition-colors text-white/90 hover:text-white"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/auth/signin"
            className="xp-btn hidden sm:flex items-center gap-2 px-4 py-1.5 text-sm"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign in</span>
          </Link>
        )}

        {/* Mobile hamburger */}
        <div ref={mobileRef} className="sm:hidden relative">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm hover:bg-white/20 transition-colors text-white/90 hover:text-white"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {mobileOpen && (
            <div className="absolute right-0 top-12 w-56 xp-panel overflow-hidden py-2 text-gray-900 dark:text-gray-100">
              <div className="flex flex-col gap-1 px-2">
                {navLinks}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-800 mt-2 pt-2 px-2">
                {session ? (
                  <>
                    <Link
                      href={`/profile/${username}`}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
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
                      className="flex items-center gap-2 px-3 py-2 rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-sm text-gray-500 dark:text-gray-400 w-full"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth/signin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm xp-btn-primary text-white text-sm font-medium"
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

      {/* Tab strip, XP-folder-tab style */}
      <div className="hidden sm:flex items-end gap-1 max-w-6xl mx-auto px-4 pt-1.5 xp-tabstrip">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 text-sm font-bold transition-colors ${
              pathname === item.href ? "xp-tab-active" : "xp-tab"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
