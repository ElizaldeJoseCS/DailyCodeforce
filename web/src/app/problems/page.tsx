"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { ratingColor } from "@/lib/utils";
import { TIERS, TIER_ORDER } from "@/lib/tiers";

interface DailyProblem {
  id: string;
  tier: string;
  date: string;
}

interface Problem {
  id: string;
  name: string;
  rating: number;
  tags: string[];
  url: string;
  dailyProblem: DailyProblem | null;
}

interface ProblemsResponse {
  problems: Problem[];
  total: number;
  page: number;
  totalPages: number;
  availableTags: string[];
}

const RATING_PRESETS = [
  { label: "All", min: 0, max: 9999 },
  ...TIER_ORDER.map((key) => ({
    label: TIERS[key].label,
    min: TIERS[key].min,
    max: TIERS[key].max,
  })),
];

const tierColors: Record<string, string> = {
  beginner: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  intermediate: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  advanced: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  expert: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [maxRating, setMaxRating] = useState(9999);
  const [selectedTag, setSelectedTag] = useState("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activePreset, setActivePreset] = useState("All");

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (minRating > 0) params.set("minRating", String(minRating));
    if (maxRating < 9999) params.set("maxRating", String(maxRating));
    if (selectedTag) params.set("tag", selectedTag);
    if (search) params.set("q", search);
    params.set("page", String(page));

    try {
      const res = await fetch(`/api/problems?${params}`);
      const data: ProblemsResponse = await res.json();
      setProblems(data.problems);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setAvailableTags(data.availableTags);
    } catch {
      setProblems([]);
    } finally {
      setLoading(false);
    }
  }, [minRating, maxRating, selectedTag, search, page]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  const handlePreset = (preset: (typeof RATING_PRESETS)[number]) => {
    setActivePreset(preset.label);
    setMinRating(preset.min);
    setMaxRating(preset.max);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setMinRating(0);
    setMaxRating(9999);
    setSelectedTag("");
    setActivePreset("All");
    setPage(1);
  };

  const hasFilters = search || minRating > 0 || maxRating < 9999 || selectedTag;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to today
      </Link>

      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Problem <span className="text-cyan-400">Browser</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} problem{total !== 1 ? "s" : ""} in database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search problems..."
              className="pl-9 pr-4 py-2 rounded-sm bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 w-64"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-sm border text-sm font-medium transition-colors ${
              showFilters || hasFilters
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                : "bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-6 p-4 xp-panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</h3>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Rating presets */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-2 block">Difficulty</label>
            <div className="flex flex-wrap gap-2">
              {RATING_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset)}
                  className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors ${
                    activePreset === preset.label
                      ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                      : "border-gray-300 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-700"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tag filter */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Tag</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {availableTags.slice(0, 30).map((tag) => (
                <button
                  key={tag}
                  onClick={() => { setSelectedTag(selectedTag === tag ? "" : tag); setPage(1); }}
                  className={`px-2.5 py-1 rounded-sm text-xs font-medium border transition-colors ${
                    selectedTag === tag
                      ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                      : "border-gray-300 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-700"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Problems grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse xp-panel p-5">
              <div className="h-4 w-24 rounded bg-gray-800 mb-3" />
              <div className="h-6 w-48 rounded bg-gray-800 mb-2" />
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded bg-gray-800" />
                <div className="h-5 w-16 rounded bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      ) : problems.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">No problems found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {problems.map((p) => {
            const dp = p.dailyProblem;
            return (
              <Link
                key={p.id}
                href={dp ? `/problem/${dp.id}` : p.url}
                target={dp ? undefined : "_blank"}
                rel={dp ? undefined : "noopener noreferrer"}
                title={dp ? undefined : "Not featured as a daily problem yet — opens on Codeforces in a new tab (no in-app editorial or judge)"}
                className={`group xp-panel p-5 hover:shadow-md transition-shadow ${!dp ? "opacity-80 hover:opacity-100" : ""}`}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2">
                    {dp && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${tierColors[dp.tier] || "text-gray-400"}`}>
                        {dp.tier.charAt(0).toUpperCase() + dp.tier.slice(1)}
                      </span>
                    )}
                    <span className={`text-sm font-mono font-bold ${ratingColor(p.rating)}`}>
                      {p.rating}
                    </span>
                  </div>
                  {!dp && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-gray-700 text-gray-500 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-colors whitespace-nowrap">
                      <ExternalLink className="w-3 h-3" />
                      Codeforces only
                    </span>
                  )}
                </div>
                <h3 className="font-medium group-hover:text-cyan-400 dark:group-hover:text-cyan-400 transition-colors mb-2">
                  {p.name}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                  {p.tags.length > 3 && (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800/60 text-gray-500">
                      +{p.tags.length - 3}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-sm border border-gray-300 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-sm border border-gray-300 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
